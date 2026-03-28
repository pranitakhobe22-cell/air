'use strict';

/**
 * AERIS — Weather Controller
 * ──────────────────────────────────────────────────────────────────
 * Proxies OpenWeatherMap API (free tier) and normalises the response
 * into the exact shape consumed by the frontend WeatherSection component.
 *
 * Endpoints served:
 *   GET /api/v1/weather/current   ?lat=&lon=  OR  ?city=
 *   GET /api/v1/weather/forecast  ?lat=&lon=  OR  ?city=
 */

const https = require('https');

const OWM_KEY  = process.env.OPENWEATHER_API_KEY;
const OWM_BASE = 'https://api.openweathermap.org/data/2.5';

// ── Fallback mock data (used while OWM key activates — up to 2h) ──
function mockCurrentPayload(query) {
  const city = query.city || 'Mumbai';
  const lat  = parseFloat(query.lat) || 19.076;
  const lon  = parseFloat(query.lon) || 72.877;
  return {
    location: { city, country: 'IN', lat, lon },
    current: {
      temperature: 31.2, feelsLike: 34.8, humidity: 62, pressure: 1008,
      windSpeed: 14.4, windDirection: 230, windDirectionLabel: 'SW',
      rainfall: 0, uvIndex: 6.2, visibility: 8.0,
      condition: 'Haze', description: 'haze', conditionIcon: '50d',
    },
    alerts: [],
    fetchedAt: new Date().toISOString(),
    _mock: true,
  };
}

function mockForecastPayload() {
  const now = new Date();
  const hourly = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now.getTime() + i * 3 * 3600000);
    return {
      time: d.toISOString().replace('T', ' ').slice(0, 19),
      temperature: 29 + Math.sin(i) * 3,
      humidity: 58 + Math.round(Math.random() * 15),
      pressure: 1010 + Math.round(Math.random() * 10),
      windSpeed: 10 + Math.round(Math.random() * 8),
      icon: '01d', description: 'clear sky',
    };
  });
  const daily = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getTime() + i * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      tempHigh: 33 + Math.round(Math.random() * 3),
      tempLow: 24 + Math.round(Math.random() * 3),
      humidity: 55 + Math.round(Math.random() * 20),
      icon: ['01d', '02d', '03d', '10d', '01d'][i],
      description: ['clear sky', 'few clouds', 'scattered clouds', 'light rain', 'clear sky'][i],
    };
  });
  return { hourly, daily, _mock: true };
}

// ── tiny fetch helper using native https ─────────────────────────
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode >= 400) {
            reject(new Error(json.message || `OWM error ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error('Invalid JSON from OpenWeatherMap'));
        }
      });
    }).on('error', reject);
  });
}

// ── build OWM query string ───────────────────────────────────────
function owmParams(query) {
  const base = `appid=${OWM_KEY}&units=metric`;
  if (query.city) return `q=${encodeURIComponent(query.city)}&${base}`;
  if (query.lat && query.lon) return `lat=${query.lat}&lon=${query.lon}&${base}`;
  return null;
}

// ── compass from degrees ─────────────────────────────────────────
const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function degToCompass(deg) {
  return COMPASS[Math.round(((deg || 0) % 360) / 22.5) % 16];
}

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/weather/current
// ─────────────────────────────────────────────────────────────────
exports.getCurrent = async (req, res) => {
  if (!OWM_KEY) {
    return res.status(503).json({ success: false, message: 'Weather API key not configured on server.' });
  }

  const params = owmParams(req.query);
  if (!params) {
    return res.status(400).json({ success: false, message: 'Provide ?city= or ?lat=&lon= query params.' });
  }

  try {
    // Fetch current weather + UV index in parallel
    const weatherUrl = `${OWM_BASE}/weather?${params}`;
    const data = await fetchJson(weatherUrl);

    // Try to get UV index (requires lat/lon — derive from response)
    let uvIndex = null;
    try {
      const uvUrl = `${OWM_BASE}/uvi?lat=${data.coord.lat}&lon=${data.coord.lon}&appid=${OWM_KEY}`;
      const uvData = await fetchJson(uvUrl);
      uvIndex = uvData.value ?? null;
    } catch { /* UV index is non-critical */ }

    const wind = data.wind || {};
    const rain = data.rain || {};
    const sys  = data.sys || {};

    const payload = {
      location: {
        city: data.name || null,
        country: sys.country || null,
        lat:  data.coord?.lat ?? null,
        lon:  data.coord?.lon ?? null,
      },
      current: {
        temperature:        data.main?.temp        ?? null,
        feelsLike:          data.main?.feels_like  ?? null,
        humidity:           data.main?.humidity    ?? null,
        pressure:           data.main?.pressure    ?? null,
        windSpeed:          wind.speed != null ? Math.round(wind.speed * 3.6 * 10) / 10 : null, // m/s → km/h
        windDirection:      wind.deg   ?? null,
        windDirectionLabel: degToCompass(wind.deg),
        rainfall:           rain['1h'] ?? rain['3h'] ?? 0,
        uvIndex,
        visibility:         data.visibility != null ? Math.round(data.visibility / 100) / 10 : null, // m → km
        condition:          data.weather?.[0]?.main        ?? null,
        description:        data.weather?.[0]?.description ?? null,
        conditionIcon:      data.weather?.[0]?.icon        ?? null,
      },
      alerts:    [],   // OWM free tier doesn't include alerts — placeholder
      fetchedAt: new Date().toISOString(),
    };

    return res.json({ success: true, data: payload });

  } catch (err) {
    console.error('[Weather/current]', err.message);
    // If OWM key hasn't activated yet, return mock data so UI works
    if (err.message.includes('Invalid API key')) {
      console.warn('[Weather] OWM key not yet active — serving mock data');
      return res.json({ success: true, data: mockCurrentPayload(req.query) });
    }
    const status = err.message.includes('city not found') ? 404 : 502;
    return res.status(status).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────
// GET /api/v1/weather/forecast
// ─────────────────────────────────────────────────────────────────
exports.getForecast = async (req, res) => {
  if (!OWM_KEY) {
    return res.status(503).json({ success: false, message: 'Weather API key not configured on server.' });
  }

  const params = owmParams(req.query);
  if (!params) {
    return res.status(400).json({ success: false, message: 'Provide ?city= or ?lat=&lon= query params.' });
  }

  try {
    const url  = `${OWM_BASE}/forecast?${params}&cnt=40`;
    const data = await fetchJson(url);

    // ── Hourly: next 24 h (8 × 3h slots) ─────────────────────
    const hourly = data.list.slice(0, 8).map((item) => ({
      time:        item.dt_txt,
      temperature: item.main?.temp        ?? null,
      humidity:    item.main?.humidity    ?? null,
      pressure:    item.main?.pressure    ?? null,
      windSpeed:   item.wind?.speed != null ? Math.round(item.wind.speed * 3.6 * 10) / 10 : null,
      icon:        item.weather?.[0]?.icon ?? null,
      description: item.weather?.[0]?.description ?? null,
    }));

    // ── Daily: group by date, pick midday reading or first ───
    const byDay = {};
    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      const hour = parseInt(item.dt_txt.split(' ')[1], 10);
      if (!byDay[date] || Math.abs(hour - 12) < Math.abs(parseInt(byDay[date].dt_txt.split(' ')[1], 10) - 12)) {
        byDay[date] = item;
      }
    }

    const daily = Object.values(byDay).slice(0, 5).map((item) => ({
      date:        item.dt_txt.split(' ')[0],
      tempHigh:    item.main?.temp_max    ?? null,
      tempLow:     item.main?.temp_min    ?? null,
      humidity:    item.main?.humidity    ?? null,
      icon:        item.weather?.[0]?.icon ?? null,
      description: item.weather?.[0]?.description ?? null,
    }));

    return res.json({ success: true, data: { hourly, daily } });

  } catch (err) {
    console.error('[Weather/forecast]', err.message);
    // If OWM key hasn't activated yet, return mock data so UI works
    if (err.message.includes('Invalid API key')) {
      console.warn('[Weather] OWM key not yet active — serving mock forecast');
      return res.json({ success: true, data: mockForecastPayload() });
    }
    return res.status(502).json({ success: false, message: err.message });
  }
};

