import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { findCachedHeal, saveHeal } from '../storage/healHistory.js';

dotenv.config();

function getApiKeys() {
  if (process.env.GEMINI_API_KEYS) {
    return process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  } else if (process.env.GEMINI_API_KEY) {
    return [process.env.GEMINI_API_KEY.trim()];
  }
  return [];
}

const apiKeys = getApiKeys();

export async function askHealAgent(context) {
  const { brokenSelector, domSnapshot, intent, lastSteps, errorMsg } = context;

  // 1. Check cache via history
  const cached = findCachedHeal(brokenSelector, intent);
  if (cached) {
    console.log(`   Cache hit: ${brokenSelector} → ${cached.healed_selector}`);
    return {
      root_cause: cached.root_cause || 'Previously healed',
      new_selector: cached.healed_selector,
      confidence: cached.confidence,
      from_cache: true
    };
  }

  // 2. Build Gemini prompt (INTENT Upgrade)
  const truncatedDom = domSnapshot.slice(0, 8000);
  
  const intentBlock = intent 
    ? `\nCRITICAL INTENT LAYER:\nThe human intent for this element was: "${intent}"\nYou MUST find the element that achieves this exact human goal, even if the entire page layout completely changed.`
    : `\nYou must find the element that visually and structurally matches what the broken selector used to target.`;

  const prompt = `You are a Playwright test self-healing agent. A test step failed because a selector no longer matches anything.

ERROR MESSAGE: ${errorMsg}
BROKEN SELECTOR: ${brokenSelector}
LAST STEPS: ${lastSteps.map(s => s.action).join(', ') || 'None'}
${intentBlock}

CURRENT DOM (Truncated):
${truncatedDom}

Reply with ONLY JSON exactly like this:
{ "root_cause": "brief explanation", "new_selector": "css selector", "confidence": 0.95 }`;

  if (apiKeys.length === 0) {
    console.error('  ❌ No Gemini API keys found in .env (GEMINI_API_KEYS or GEMINI_API_KEY)');
    return { root_cause: 'API keys missing', new_selector: null, confidence: 0 };
  }

  let lastError = null;

  // 3. Round-robin / Fallback through available keys
  for (const key of apiKeys) {
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const res = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
      let text = res.text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      const result = JSON.parse(text);

      saveHeal({
        original_selector: brokenSelector,
        healed_selector: result.new_selector,
        intent,
        root_cause: result.root_cause,
        confidence: result.confidence,
        method: intent ? 'gemini-ai-intent' : 'gemini-ai'
      });

      return { ...result, from_cache: false };
    } catch (err) {
      console.warn(`  ⚠️ Gemini API attempt failed with a key: ${err.message}`);
      lastError = err;
    }
  }

  console.error('  ❌ All Gemini API keys failed. Last error:', lastError?.message);
  return { root_cause: 'Gemini API failed', new_selector: null, confidence: 0 };
}
