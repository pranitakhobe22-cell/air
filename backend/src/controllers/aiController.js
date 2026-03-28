'use strict';

const { getChatResponse } = require('../services/aiChatService');

exports.chat = async (req, res) => {
  try {
    const { messages, lat, lon, city, persona, activity, sensors, environment, aqi, category, dominant } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: 'messages array is required' });
    }
    const data = await getChatResponse({ messages, lat, lon, city, persona, activity, sensors, environment, aqi, category, dominant });
    res.json({ success: true, data });
  } catch (err) {
    console.error('[AI CHAT]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

