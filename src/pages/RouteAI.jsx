import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPin, Navigation, Clock, Wind, Activity, ShieldAlert, CheckCircle2, Route as RouteIcon, Loader2, BrainCircuit, Send, User, X, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';
import useAerisStore from '@/store/aerisStore';
import 'leaflet/dist/leaflet.css';

const routeApi = axios.create({
  baseURL: import.meta.env.VITE_WEATHER_URL || 'http://localhost:3000/api/v1',
  timeout: 60000,
});

/* ── Auto-fit map ──────────────────────────────────────────── */
function FitBounds({ path }) {
  const map = useMap();
  useEffect(() => {
    if (!path || path.length < 2) return;
    const lats = path.map(p => p.lat || p[0]);
    const lngs = path.map(p => p.lng || p[1]);
    map.fitBounds(
      [[Math.min(...lats) - 0.01, Math.min(...lngs) - 0.01],
       [Math.max(...lats) + 0.01, Math.max(...lngs) + 0.01]],
      { padding: [40, 40], maxZoom: 15 }
    );
  }, [path, map]);
  return null;
}

/* ── AQI segment color ─────────────────────────────────────── */
function aqiColor(aqi) {
  if (aqi <= 50) return '#22c55e';
  if (aqi <= 100) return '#eab308';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#8b5cf6';
  return '#991b1b';
}

export default function RouteAI() {
  const [aiOpen, setAiOpen] = useState(false);
  const storeData = useAerisStore((s) => s.data);

  // ── AI Chat state ──────────────────────────────
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', content: 'Hello! I\'m **AERIS AI** — your environmental intelligence assistant.\n\nI can help with:\n- Current AQI and air quality analysis\n- Route safety recommendations\n- Health advice based on live sensor data\n\nHow can I assist you?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatTyping, setChatTyping] = useState(false);
  const chatEndRef = useRef(null);

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatTyping) return;
    const userMsg = { role: 'user', content: chatInput };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput('');
    setChatTyping(true);
    try {
      const { data: res } = await routeApi.post('/ai/chat', {
        messages: updated.map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content })),
        sensors: storeData?.sensors || {}, environment: storeData?.environment || {},
        aqi: storeData?.derived?.aqi || 0, category: storeData?.derived?.aqi_category || '',
        dominant: storeData?.derived?.dominant || 'PM2.5', city: storeData?.meta?.location || 'Unknown',
      });
      setChatMessages(prev => [...prev, { role: 'ai', content: res.data?.content || 'Sorry, I could not process that.' }]);
    } catch {
      const aqi = storeData?.derived?.aqi || 0;
      setChatMessages(prev => [...prev, { role: 'ai', content: aqi > 100
        ? `Based on current AQI of **${aqi}**, air quality needs attention.\n- Limit outdoor exposure\n- Wear a mask if going out`
        : `Current AQI is **${aqi}** — conditions are ${aqi <= 50 ? 'good' : 'moderate'}. Safe for most activities.\n\n_AI service unavailable — rule-based response._`
      }]);
    } finally { setChatTyping(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, chatTyping]);

  const [origin, setOrigin] = useState('Connaught Place, New Delhi');
  const [destination, setDestination] = useState('India Gate, New Delhi');
  const [routeAnalysis, setRouteAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const handleAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await routeApi.post('/route/analyze', { origin, destination });
      if (data.success) {
        setRouteAnalysis(data.data);
      } else {
        setError(data.message || 'Analysis failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [origin, destination]);

  useEffect(() => { handleAnalysis(); }, []);

  useEffect(() => {
    if (routeAnalysis?.recommendedRouteId) setSelectedRoute(routeAnalysis.recommendedRouteId);
    else if (routeAnalysis?.routes?.length > 0) setSelectedRoute(routeAnalysis.routes[0].id);
  }, [routeAnalysis]);

  const selectedRouteData = useMemo(
    () => routeAnalysis?.routes?.find(r => r.id === selectedRoute),
    [routeAnalysis, selectedRoute]
  );

  const activePath = useMemo(() => {
    if (!selectedRouteData?.path?.length) return null;
    return selectedRouteData.path.map(p => [p.lat, p.lng]);
  }, [selectedRouteData]);

  const startPoint = activePath?.[0];
  const endPoint = activePath?.[activePath.length - 1];
  const mapCenter = startPoint || [28.6139, 77.209];

  return (
    <div className="p-6 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-(--color-text-primary)">Route AI</h1>
          <p className="text-xs sm:text-sm text-(--color-text-secondary) mt-1">A Path Finding Engine — finds the cleanest-air route between any two locations.</p>
        </div>
        <button
          onClick={() => setAiOpen(!aiOpen)}
          className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-(--color-primary) to-(--color-secondary) text-white text-sm font-bold rounded-xl shadow-md shadow-(--color-primary)/20 hover:opacity-90 transition-all active:scale-[0.97]"
        >
          <BrainCircuit size={16} />
          {aiOpen ? 'Hide AI' : 'Ask AERIS AI'}
          {aiOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── AERIS AI Chat Section ──────────────────────── */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="glass-card rounded-xl border border-(--color-card-border) overflow-hidden">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-(--color-card-border)">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-(--color-accent)/10 flex items-center justify-center">
                    <BrainCircuit size={14} className="text-(--color-accent)" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-(--color-text-primary)">AERIS AI</span>
                    <span className="text-[10px] text-(--color-text-secondary) ml-2">Environmental Intelligence</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider border border-emerald-500/20">Live</span>
                  <span className="text-[10px] text-(--color-text-secondary)">
                    AQI: <strong className="text-(--color-text-primary)">{storeData?.derived?.aqi || '—'}</strong>
                    <span className="mx-1.5">|</span>
                    PM2.5: <strong className="text-(--color-text-primary)">{storeData?.sensors?.pm25?.toFixed?.(1) || '—'}</strong>
                  </span>
                  <button onClick={() => setAiOpen(false)} className="p-1 rounded-lg text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="h-[360px] overflow-y-auto p-5 space-y-4 glass-scrollbar">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === 'user'
                        ? 'bg-(--color-primary) text-white'
                        : 'bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20'
                    }`}>
                      {msg.role === 'user' ? <User size={12} /> : <BrainCircuit size={12} />}
                    </div>
                    <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-(--color-primary) text-white rounded-tr-sm'
                        : 'subtle-surface border border-(--color-card-border) rounded-tl-sm text-(--color-text-primary)'
                    }`}>
                      {msg.content.split('\n').map((line, j) => {
                        const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/_(.+?)_/g, '<em>$1</em>');
                        if (line.trim().startsWith('- ') || line.trim().startsWith('• '))
                          return <li key={j} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: html.replace(/^[\s]*[-•]\s*/, '') }} />;
                        if (line.trim() === '') return <br key={j} />;
                        return <p key={j} dangerouslySetInnerHTML={{ __html: html }} />;
                      })}
                    </div>
                  </div>
                ))}
                {chatTyping && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20 flex items-center justify-center shrink-0">
                      <BrainCircuit size={12} />
                    </div>
                    <div className="px-4 py-3.5 rounded-2xl subtle-surface border border-(--color-card-border) rounded-tl-sm flex gap-1.5 items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-bounce" style={{ animationDelay: '0.15s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent) animate-bounce" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="px-5 py-3 border-t border-(--color-card-border)">
                <form onSubmit={handleChat} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about air quality, routes, health advice..."
                    className="flex-1 subtle-surface border border-(--color-card-border) rounded-xl px-4 py-2.5 text-[13px] text-(--color-text-primary) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:ring-2 focus:ring-(--color-accent)/30 transition-all"
                  />
                  <button type="submit" disabled={!chatInput.trim() || chatTyping}
                    className="px-4 py-2.5 rounded-xl bg-(--color-primary) text-white disabled:opacity-40 hover:opacity-90 transition-all">
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── Left: Inputs + Route Cards ─────────────────── */}
        <div className="lg:col-span-5 space-y-5 flex flex-col">
          <div className="glass-card rounded-xl border border-(--color-card-border) p-5">
            <h2 className="text-xs font-medium text-(--color-text-secondary) opacity-60 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin size={14} className="text-(--color-accent)" /> Waypoints
            </h2>
            <div className="flex flex-col gap-3 mb-4">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Origin — city, landmark, or address"
                  className="w-full subtle-surface border border-(--color-card-border) rounded-lg pl-9 pr-4 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 transition-all" />
              </div>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
                  placeholder="Destination — city, landmark, or address"
                  className="w-full subtle-surface border border-(--color-card-border) rounded-lg pl-9 pr-4 py-2.5 text-sm text-(--color-text-primary) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:ring-2 focus:ring-(--color-accent)/40 transition-all" />
              </div>
              <button onClick={handleAnalysis} disabled={loading}
                className="w-full mt-1 px-5 py-3 bg-linear-to-r from-(--color-primary) to-(--color-secondary) hover:opacity-90 text-white font-bold rounded-xl shadow-md shadow-(--color-primary)/20 transition-all active:scale-[0.98] text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                {loading ? 'Computing A* Route...' : 'Analyze Routes'}
              </button>
            </div>

            {routeAnalysis?.gridInfo && (
              <div className="text-[11px] text-(--color-text-secondary) flex gap-3 mt-2 p-2 rounded-lg subtle-surface border border-(--color-card-border)">
                <span>{routeAnalysis.gridInfo.totalNodes} grid nodes</span>
                <span>{routeAnalysis.gridInfo.anchorsUsed} AQI anchors</span>
                <span>{routeAnalysis.gridInfo.cellSizeKm}km cells</span>
              </div>
            )}
          </div>

          {/* Route Cards or Loading/Error */}
          {loading ? (
            <div className="glass-card rounded-xl border border-(--color-card-border) p-6 min-h-[280px] flex flex-col gap-3 items-center justify-center flex-1">
              <Loader2 size={28} className="animate-spin text-(--color-accent)" />
              <p className="text-sm text-(--color-text-secondary)">Running A* pathfinding across grid...</p>
              <p className="text-[11px] text-(--color-text-secondary) opacity-50">Geocoding → Grid → IDW weighting → A* search</p>
            </div>
          ) : routeAnalysis ? (
            <div className="flex flex-col gap-3 flex-1">
              {routeAnalysis.routes?.map((route) => {
                const isSelected = route.id === selectedRoute;
                const isRec = route.id === routeAnalysis.recommendedRouteId;
                const riskCls = route.riskLevel === 'high' || route.riskLevel === 'severe' ? 'text-rose-400' : route.riskLevel === 'moderate' ? 'text-amber-400' : 'text-emerald-400';
                return (
                  <motion.button initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={route.id}
                    onClick={() => setSelectedRoute(route.id)}
                    className={`w-full text-left glass-card rounded-xl p-5 border-2 transition-all duration-300 relative overflow-hidden group ${isSelected ? 'border-(--color-accent) shadow-lg shadow-(--color-accent)/10' : 'border-transparent hover:border-(--color-card-border)'}`}>
                    {isSelected && <div className="absolute top-0 left-0 w-1 h-full bg-(--color-accent)" />}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-(--color-text-primary)">{route.label}</h4>
                        {isRec && (
                          <span className="bg-(--color-accent)/10 text-(--color-accent) px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 border border-(--color-accent)/25">
                            <CheckCircle2 size={10} /> Recommended
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs text-(--color-text-secondary) mb-3">
                      <div className="flex items-center gap-2"><Clock size={13} className="opacity-50" /><span className="font-semibold text-(--color-text-primary)">{route.durationMinutes} min</span></div>
                      <div className="flex items-center gap-2"><Activity size={13} className="opacity-50" /><span className="font-semibold text-(--color-text-primary)">{route.distanceKm} km</span></div>
                      <div className="flex items-center gap-2"><Wind size={13} className="opacity-50" /><span className="font-semibold text-orange-400">AQI {route.avgAqi}</span></div>
                      <div className="flex items-center gap-2"><ShieldAlert size={13} className="opacity-50" /><span className={`font-semibold capitalize ${riskCls}`}>{route.riskLevel}</span></div>
                    </div>
                    {route.minAqi !== undefined && (
                      <div className="text-[11px] text-(--color-text-secondary) flex gap-4 mb-3 p-2 rounded-lg border border-(--color-card-border) subtle-surface">
                        <span>Min AQI: <strong className="text-(--color-text-primary)">{route.minAqi}</strong></span>
                        <span>Max AQI: <strong className="text-(--color-text-primary)">{route.maxAqi}</strong></span>
                        <span>Waypoints: <strong className="text-(--color-text-primary)">{route.waypoints}</strong></span>
                      </div>
                    )}
                    {route.summary && (
                      <p className={`text-[11px] p-2.5 rounded-lg border ${isSelected ? 'bg-(--color-accent)/5 border-(--color-accent)/20 text-(--color-text-primary)' : 'border-(--color-card-border) subtle-surface text-(--color-text-secondary)'}`}>
                        {route.summary}
                      </p>
                    )}
                  </motion.button>
                );
              })}
            </div>
          ) : error ? (
            <div className="glass-card rounded-xl border border-rose-500/20 p-6 bg-rose-500/5 flex flex-col items-center justify-center flex-1">
              <ShieldAlert size={40} className="text-rose-400 mb-3 opacity-50" />
              <p className="text-sm font-bold text-rose-400">Unable to load route analysis.</p>
              <p className="text-xs text-rose-400/70 mt-1">{error}</p>
            </div>
          ) : null}
        </div>

        {/* ── Right: Map ────────────────────────────────── */}
        <div className="lg:col-span-7 relative glass-card rounded-xl overflow-hidden border border-(--color-card-border)" style={{ height: 'fit-content' }}>
          <div className="absolute top-3 right-3 z-[400] glass-card backdrop-blur-md p-3 rounded-xl border border-(--color-card-border) shadow-lg text-[11px] space-y-1.5">
            <div className="font-bold text-(--color-text-primary) border-b border-(--color-card-border) pb-1.5 mb-1 uppercase tracking-wider flex items-center gap-1.5"><RouteIcon size={12} /> Legend</div>
            <div className="flex items-center gap-2 text-(--color-text-secondary)"><span className="w-3.5 h-1 bg-emerald-500 rounded-full" /> Good (0-50)</div>
            <div className="flex items-center gap-2 text-(--color-text-secondary)"><span className="w-3.5 h-1 bg-yellow-500 rounded-full" /> Moderate (51-100)</div>
            <div className="flex items-center gap-2 text-(--color-text-secondary)"><span className="w-3.5 h-1 bg-orange-500 rounded-full" /> USG (101-150)</div>
            <div className="flex items-center gap-2 text-(--color-text-secondary)"><span className="w-3.5 h-1 bg-rose-500 rounded-full" /> Unhealthy (151+)</div>
            <div className="flex items-center gap-2 text-(--color-text-secondary)"><span className="w-3.5 h-1 bg-slate-500/50 rounded-full border border-dashed border-slate-500" /> Unselected</div>
          </div>

          <MapContainer center={mapCenter} zoom={13} style={{ height: '600px', width: '100%', background: '#f8fafc' }} zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            {activePath && <FitBounds path={selectedRouteData?.path} />}

            {routeAnalysis?.routes?.map(route => {
              if (selectedRoute === route.id || !route.path?.length) return null;
              return (
                <Polyline key={route.id} positions={route.path.map(p => [p.lat, p.lng])}
                  pathOptions={{ color: '#64748b', weight: 4, opacity: 0.35, dashArray: '6, 8' }}
                  eventHandlers={{ click: () => setSelectedRoute(route.id) }} />
              );
            })}

            {selectedRouteData?.path?.length > 1 && selectedRouteData.path.slice(0, -1).map((pt, i) => {
              const next = selectedRouteData.path[i + 1];
              return <Polyline key={`seg-${i}`} positions={[[pt.lat, pt.lng], [next.lat, next.lng]]}
                pathOptions={{ color: aqiColor(next.aqi), weight: 5, opacity: 0.9 }} />;
            })}

            {selectedRouteData?.path?.map((pt, i) => (
              <CircleMarker key={`wp-${i}`} center={[pt.lat, pt.lng]} radius={3}
                pathOptions={{ fillColor: aqiColor(pt.aqi), color: '#fff', weight: 1, fillOpacity: 0.9 }}>
                <Popup><strong>Waypoint {i + 1}</strong><br />AQI: {pt.aqi}<br />[{pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}]</Popup>
              </CircleMarker>
            ))}

            {startPoint && (
              <CircleMarker center={startPoint} radius={8} pathOptions={{ fillColor: '#06b6d4', color: '#fff', weight: 3, fillOpacity: 1 }}>
                <Popup><strong>Origin:</strong> {routeAnalysis?.origin || origin}</Popup>
              </CircleMarker>
            )}
            {endPoint && (
              <CircleMarker center={endPoint} radius={8} pathOptions={{ fillColor: '#6366f1', color: '#fff', weight: 3, fillOpacity: 1 }}>
                <Popup><strong>Destination:</strong> {routeAnalysis?.destination || destination}</Popup>
              </CircleMarker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
