'use strict';

/**
 * AERIS AI Chat Service — Groq LLM with live telemetry context
 * Falls back to rule-based responses if Groq key is missing
 */

const GROQ_KEY = process.env.GROQ_API_KEY;
const MODEL = 'llama-3.3-70b-versatile';

let groq = null;
if (GROQ_KEY && GROQ_KEY !== 'placeholder') {
  const Groq = require('groq-sdk');
  groq = new Groq({ apiKey: GROQ_KEY });
}

function buildSystemPrompt({ city, lat, lon, persona, activity, sensors, environment, aqi, category, dominant }) {
  const s = sensors || {};
  const e = environment || {};
  return `You are AERIS AI, an advanced air quality intelligence assistant for the AERIS environmental monitoring platform.
You provide personalized, data-driven environmental health advice.

USER PROFILE:
- Persona: ${persona || 'General User'}
- Activity: ${activity || 'General Outdoor'}
- Location: ${city || 'Unknown'} (${lat || '—'}, ${lon || '—'})

LIVE SENSOR DATA:
- AQI: ${aqi || 'N/A'} (${category || 'Unknown'})
- Dominant Pollutant: ${dominant || 'PM2.5'}
- PM2.5: ${s.pm25 || 0} µg/m³
- CO: ${s.co || 0} ppm
- O₃: ${s.o3 || 0} ppb
- NO₂: ${s.nox || 0} ppb
- VOC: ${s.voc_index || 0}

ENVIRONMENT:
- Temperature: ${e.temperature || 0}°C
- Humidity: ${e.humidity || 0}%
- Wind: ${e.windSpeed || 0} m/s
- Pressure: ${e.pressure || 1013} hPa

RULES:
1. Reference REAL data from sensors above. Never fabricate numbers.
2. Give health advice personalized to persona and activity.
3. Be concise — use bullet points for actionable advice.
4. If AQI > 150, strongly warn about outdoor activities.
5. If AQI > 100, suggest precautions for sensitive groups.
6. For route-related questions, advise based on AQI levels along the path.
7. Format with markdown for readability.
8. Be friendly and professional. You represent AERIS.`;
}

function fallbackResponse({ aqi, activity, sensors }) {
  const a = aqi || 0;
  const pm25 = sensors?.pm25 || 0;
  let advice;

  if (a > 150) {
    advice = `⚠️ **High AQI Alert (${a})**\n\nThe current AQI is unhealthy. I recommend:\n- Avoid outdoor ${activity || 'activities'}\n- Keep windows closed\n- Wear an N95 mask if going outside\n- Use an air purifier indoors\n- PM2.5 is at ${pm25} µg/m³ — significantly above safe levels`;
  } else if (a > 100) {
    advice = `⚡ **Moderate AQI (${a})**\n\nSensitive groups should take precautions:\n- Limit prolonged outdoor exertion\n- Consider wearing a mask for ${activity || 'outdoor activities'}\n- Monitor symptoms like coughing or eye irritation\n- PM2.5: ${pm25} µg/m³`;
  } else if (a > 50) {
    advice = `🟡 **Fair Air Quality (AQI: ${a})**\n\nGenerally safe, but:\n- Sensitive individuals should monitor conditions\n- ${activity || 'Outdoor activities'} are okay with normal precautions\n- PM2.5: ${pm25} µg/m³ — within moderate range`;
  } else {
    advice = `✅ **Good Air Quality (AQI: ${a})**\n\nConditions are excellent for ${activity || 'outdoor activities'}!\n- No restrictions needed\n- Great time for exercise outdoors\n- PM2.5: ${pm25} µg/m³ — well within safe limits`;
  }

  return {
    content: advice + '\n\n_Powered by AERIS sensor data analysis._',
    model: 'rule-based',
  };
}

async function getChatResponse({ messages, lat, lon, city, persona, activity, sensors, environment, aqi, category, dominant }) {
  if (!groq) {
    return fallbackResponse({ aqi, activity, sensors });
  }

  const systemPrompt = buildSystemPrompt({ city, lat, lon, persona, activity, sensors, environment, aqi, category, dominant });

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content })),
  ];

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024,
      top_p: 0.9,
    });

    return {
      content: completion.choices[0]?.message?.content || 'I could not generate a response. Please try again.',
      model: MODEL,
    };
  } catch (err) {
    console.error('[AI] Groq error:', err.message);
    return fallbackResponse({ aqi, activity, sensors });
  }
}

module.exports = { getChatResponse };

