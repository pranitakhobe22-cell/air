import { GoogleGenerativeAI } from '@google/generative-ai';

export async function askHealAgent(failureBundle) {
    const { error, selector, intent, domSnapshot } = failureBundle;

    const keyString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keyString) {
        console.error("  ❌ GEMINI_API_KEY(S) missing from environment.");
        return { rootCause: "Missing API Key", newSelector: null, confidence: 0 };
    }

    const keys = keyString.split(',').map(k => k.trim()).filter(Boolean);

    let prompt;

    if (intent) {
        prompt = `The goal of this step was to: ${intent}.
The selector that was tried: ${selector}
That selector no longer exists. 
Look at this DOM and find the element that best achieves the stated goal.
Do not just find a similar selector — find the element that completes the intent.

-- ERROR --
${error}

-- DOM SNAPSHOT (Truncated) --
${domSnapshot.substring(0, 15000)}

Return your response ONLY as a valid JSON object with the following properties, and no other text or explanation. Do not wrap in markdown code fences.
{
  "rootCause": "Explanation",
  "newSelector": "The exact CSS selector",
  "confidence": 0.95
}`;
    } else {
        prompt = `The selector ${selector} was not found. Look at the DOM and find the new selector.

-- ERROR --
${error}

-- BROKEN SELECTOR --
${selector}

-- DOM SNAPSHOT (Truncated) --
${domSnapshot.substring(0, 15000)}

Return your response ONLY as a valid JSON object with the following properties, and no other text or explanation. Do not wrap in markdown code fences.
{
  "rootCause": "Explanation",
  "newSelector": "The fixed CSS selector",
  "confidence": 0.95
}`;
    }

    for (const apiKey of keys) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();

            text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            const parsed = JSON.parse(text);

            return {
                rootCause: parsed.rootCause || "AI analysis completed",
                newSelector: parsed.newSelector || null,
                confidence: parsed.confidence || 0.8
            };
        } catch (err) {
            console.error(`  ⚠️ Heal Agent AI Error (key ${apiKey.substring(0, 8)}...):`, err.message);
        }
    }

    return {
        rootCause: "AI API Failure: All API keys exhausted",
        newSelector: null,
        confidence: 0,
    };
}
