'use strict';

/**
 * AERIS Route AI — A* Pathfinding with AQI-weighted grid
 *
 * Pipeline: Geocode → Grid → WAQI anchors → IDW → A* → Two routes
 */

const turf = require('@turf/turf');
const axios = require('axios');
const { haversineKm, idw } = require('../utils/geo');

// ── Priority Queue ─────────────────────────────────────────────
class MinPQ {
  constructor() { this.h = []; }
  push(item) { this.h.push(item); this._up(this.h.length - 1); }
  pop() {
    const top = this.h[0], bot = this.h.pop();
    if (this.h.length > 0) { this.h[0] = bot; this._dn(0); }
    return top;
  }
  get size() { return this.h.length; }
  _up(i) {
    const el = this.h[i];
    while (i > 0) { const p = (i - 1) >> 1; if (this.h[p].f <= el.f) break; this.h[i] = this.h[p]; i = p; }
    this.h[i] = el;
  }
  _dn(i) {
    const n = this.h.length, el = this.h[i];
    while (true) {
      let s = null; const l = 2*i+1, r = 2*i+2;
      if (l < n && this.h[l].f < el.f) s = l;
      if (r < n && this.h[r].f < (s !== null ? this.h[l].f : el.f)) s = r;
      if (s === null) break; this.h[i] = this.h[s]; i = s;
    }
    this.h[i] = el;
  }
}

// ── WAQI AQI Anchors ───────────────────────────────────────────
const WAQI_TOKEN = process.env.WAQI_TOKEN || 'demo';
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Try to get a live AQI from our own Cosmos DB sensors.
 * Returns the latest AQI from any active ESP32 node, or null if unavailable.
 */
async function getOwnSensorAqi() {
  try {
    const { isConfigured, getContainer } = require('../../config/cosmosdb');
    if (!isConfigured()) return null;
    const container = await getContainer();
    const { resources } = await container.items
      .query({ query: 'SELECT TOP 1 c.aqi FROM c ORDER BY c.timestamp DESC' }, { enableCrossPartitionQuery: true })
      .fetchAll();
    if (resources.length > 0 && typeof resources[0].aqi === 'number') return resources[0].aqi;
  } catch { /* ignore */ }
  return null;
}

async function fetchAqiAt(lat, lon) {
  try {
    const { data } = await axios.get(`https://api.waqi.info/feed/geo:${lat};${lon}/`, {
      params: { token: WAQI_TOKEN }, timeout: 10000,
    });
    if (data.status === 'ok' && data.data) {
      const aqi = typeof data.data.aqi === 'number' ? data.data.aqi : parseInt(data.data.aqi, 10) || 0;
      if (aqi > 0) return { lat: data.data.city?.geo?.[0] ?? lat, lng: data.data.city?.geo?.[1] ?? lon, aqi };
    }
  } catch { /* fallback */ }
  // Fallback: use our own sensor AQI, or 50 as last resort
  const ownAqi = await getOwnSensorAqi();
  return { lat, lng: lon, aqi: ownAqi || 50 };
}

async function getAnchors(cLat, cLng) {
  const key = `${cLat.toFixed(1)},${cLng.toFixed(1)}`;
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const center = await fetchAqiAt(cLat, cLng);
  const anchors = [center];
  const offsets = [[.15,0],[-.15,0],[0,.15],[0,-.15],[.1,.1],[-.1,-.1],[.1,-.1],[-.1,.1]];
  const results = await Promise.allSettled(offsets.map(([dl, dn]) => fetchAqiAt(cLat + dl, cLng + dn)));
  results.forEach(r => { if (r.status === 'fulfilled' && r.value) anchors.push(r.value); });

  _cache.set(key, { data: anchors, ts: Date.now() });
  if (_cache.size > 20) _cache.delete(_cache.keys().next().value);
  return anchors;
}

// ── Grid ───────────────────────────────────────────────────────
function generateGrid(sLat, sLng, eLat, eLng, cellKm) {
  const BUF = 5;
  const minLat = Math.min(sLat, eLat), maxLat = Math.max(sLat, eLat);
  const minLng = Math.min(sLng, eLng), maxLng = Math.max(sLng, eLng);
  const latD = BUF / 111.32;
  const lngD = BUF / (111.32 * Math.cos(((minLat + maxLat) / 2) * Math.PI / 180));
  const bbox = [minLng - lngD, minLat - latD, maxLng + lngD, maxLat + latD];
  const grid = turf.pointGrid(bbox, cellKm, { units: 'kilometers' });
  return { bbox, points: grid.features.map(f => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] })) };
}

// ── Graph ──────────────────────────────────────────────────────
function buildGraph(pts, anchors) {
  const P = 4, round = v => parseFloat(v.toFixed(P));
  const latSet = new Set(pts.map(p => round(p.lat)));
  const lngSet = new Set(pts.map(p => round(p.lng)));
  const lats = [...latSet].sort((a, b) => a - b);
  const lngs = [...lngSet].sort((a, b) => a - b);
  const rows = lats.length, cols = lngs.length;
  const latIdx = new Map(lats.map((v, i) => [v, i]));
  const lngIdx = new Map(lngs.map((v, i) => [v, i]));
  const nodes = new Array(rows * cols).fill(null);
  const getKey = (r, c) => r * cols + c;

  for (const pt of pts) {
    const r = latIdx.get(round(pt.lat)), c = lngIdx.get(round(pt.lng));
    if (r === undefined || c === undefined) continue;
    const key = getKey(r, c);
    nodes[key] = { key, row: r, col: c, lat: pt.lat, lng: pt.lng, aqi: idw(pt.lat, pt.lng, anchors, 2, 100).aqi };
  }

  const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  const adj = new Map();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = getKey(r, c);
      if (!nodes[key]) continue;
      const nb = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && nodes[getKey(nr, nc)]) nb.push(getKey(nr, nc));
      }
      adj.set(key, nb);
    }
  }
  return { nodes, cols, rows, getKey, adj };
}

// ── Cost ───────────────────────────────────────────────────────
function aqiMult(aqi) {
  if (aqi <= 50) return 1; if (aqi <= 100) return 1.5; if (aqi <= 150) return 3;
  if (aqi <= 200) return 6; if (aqi <= 300) return 12; return 25;
}

// ── A* ─────────────────────────────────────────────────────────
function astar(graph, sKey, eKey, useAqi = true) {
  const { nodes, adj } = graph;
  const goal = nodes[eKey];
  const h = k => haversineKm(nodes[k].lat, nodes[k].lng, goal.lat, goal.lng);
  const g = new Map(), came = new Map(), closed = new Set();
  g.set(sKey, 0);
  const open = new MinPQ();
  open.push({ key: sKey, f: h(sKey) });

  while (open.size > 0) {
    const { key: cur } = open.pop();
    if (cur === eKey) return rebuildPath(came, cur, nodes);
    if (closed.has(cur)) continue;
    closed.add(cur);
    const cg = g.get(cur) ?? Infinity;
    for (const nk of (adj.get(cur) || [])) {
      if (closed.has(nk)) continue;
      const dist = haversineKm(nodes[cur].lat, nodes[cur].lng, nodes[nk].lat, nodes[nk].lng);
      const cost = useAqi ? dist * aqiMult(nodes[nk].aqi) : dist;
      const tg = cg + cost;
      if (tg < (g.get(nk) ?? Infinity)) {
        came.set(nk, cur); g.set(nk, tg);
        open.push({ key: nk, f: tg + h(nk) });
      }
    }
  }
  return [{ lat: nodes[sKey].lat, lng: nodes[sKey].lng, aqi: nodes[sKey].aqi }, { lat: goal.lat, lng: goal.lng, aqi: goal.aqi }];
}

function rebuildPath(came, cur, nodes) {
  const path = [];
  while (cur !== undefined) { const n = nodes[cur]; path.unshift({ lat: n.lat, lng: n.lng, aqi: n.aqi }); cur = came.get(cur); }
  return path;
}

function findNearest(graph, lat, lng) {
  let best = null, bd = Infinity;
  for (const n of graph.nodes) { if (!n) continue; const d = haversineKm(lat, lng, n.lat, n.lng); if (d < bd) { bd = d; best = n.key; } }
  return best;
}

// ── Stats ──────────────────────────────────────────────────────
function routeStats(path) {
  let dist = 0, sumAqi = 0, maxA = 0, minA = 500;
  for (let i = 0; i < path.length; i++) {
    sumAqi += path[i].aqi; if (path[i].aqi > maxA) maxA = path[i].aqi; if (path[i].aqi < minA) minA = path[i].aqi;
    if (i > 0) dist += haversineKm(path[i-1].lat, path[i-1].lng, path[i].lat, path[i].lng);
  }
  const avg = Math.round(sumAqi / (path.length || 1));
  return {
    distanceKm: parseFloat(dist.toFixed(2)), durationMinutes: Math.round((dist / 5) * 60),
    avgAqi: avg, maxAqi: maxA, minAqi: minA,
    exposureScore: Math.min(100, Math.round(avg / 3)),
    riskLevel: avg > 200 ? 'severe' : avg > 150 ? 'high' : avg > 100 ? 'moderate' : 'low',
    waypoints: path.length,
  };
}

// ── Geocode via Nominatim ──────────────────────────────────────
async function geocode(name) {
  if (!name) return null;
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: name, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'AERIS/1.0' }, timeout: 5000,
    });
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
  } catch { /* ignore */ }
  return null;
}

// ── Public API ─────────────────────────────────────────────────
async function analyzeRoute({ origin, destination, startLat, startLng, endLat, endLng }) {
  // Geocode if needed
  if (!startLat && origin) {
    const g = await geocode(origin);
    if (g) { startLat = g.lat; startLng = g.lng; }
  }
  if (!endLat && destination) {
    const g = await geocode(destination);
    if (g) { endLat = g.lat; endLng = g.lng; }
  }

  const sLat = parseFloat(startLat || 28.6139), sLng = parseFloat(startLng || 77.209);
  const eLat = parseFloat(endLat || sLat + 0.05), eLng = parseFloat(endLng || sLng + 0.05);

  console.log(`[ROUTE A*] ${origin || 'Start'} → ${destination || 'End'} [${sLat},${sLng}] → [${eLat},${eLng}]`);

  const directDist = haversineKm(sLat, sLng, eLat, eLng);
  const cellSize = directDist < 5 ? 0.5 : directDist < 20 ? 1 : 2;
  const { points } = generateGrid(sLat, sLng, eLat, eLng, cellSize);
  console.log(`[ROUTE A*] Grid: ${points.length} nodes (${cellSize}km cells)`);

  const anchors = await getAnchors((sLat + eLat) / 2, (sLng + eLng) / 2);
  const graph = buildGraph(points, anchors);
  const sKey = findNearest(graph, sLat, sLng), eKey = findNearest(graph, eLat, eLng);
  if (sKey === null || eKey === null) throw new Error('Could not map coordinates to grid.');

  const safePath = astar(graph, sKey, eKey, true);
  const directPath = astar(graph, sKey, eKey, false);
  const safeS = routeStats(safePath), directS = routeStats(directPath);

  return {
    origin: origin || 'Start', destination: destination || 'End',
    gridInfo: { totalNodes: points.length, cellSizeKm: cellSize, anchorsUsed: anchors.length },
    recommendedRouteId: safeS.avgAqi <= directS.avgAqi ? 'route-safe' : 'route-direct',
    routes: [
      { id: 'route-safe', label: 'Safest Route (Cleanest Air)', ...safeS, path: safePath, summary: `A* optimised path avoiding high-AQI zones. Average AQI: ${safeS.avgAqi}.` },
      { id: 'route-direct', label: 'Direct Route (Shortest)', ...directS, path: directPath, summary: `Shortest path through the grid. Average AQI: ${directS.avgAqi}.` },
    ],
  };
}

module.exports = { analyzeRoute, geocode };

