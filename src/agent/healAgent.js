import { GoogleGenerativeAI } from '@google/generative-ai';

export async function askHealAgent(failureBundle) {
    const { error, selector, intent, domSnapshot } = failureBundle;

    const keyString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!keyString) {
        console.error("  ❌ GEMINI_API_KEY(S) missing from environment.");
        return { rootCause: "Missing API Key", newSelector: null, confidence: 0 };
    }

    const keys = keyString.split(',').map(k => k.trim()).filter(Boolean);

    const intentBlock = intent ? `\n-- INTENT --\nThe human intent for this action was: "${intent}"\nYou MUST find the element that achieves this exact human goal, even if the page layout changed.` : '';

    const prompt = `You are an AI healing agent for Playwright test automation.
A UI test failed because the selector no longer matches any element in the DOM.

-- ERROR --
${error}

-- BROKEN SELECTOR --
${selector}
${intentBlock}

-- DOM SNAPSHOT (Truncated) --
${domSnapshot.substring(0, 15000)}

Your job is to find the exact replacement selector based on the DOM structure and your understanding of standard web layouts.
Return your response ONLY as a valid JSON object with the following properties, and no other text or explanation. Do not wrap in markdown.
{
  "rootCause": "Explanation of why the selector broke",
  "newSelector": "The fixed CSS selector",
  "confidence": 0.95
}`;

    for (const apiKey of keys) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            const result = await model.generateContent(prompt);
            let text = result.response.text().trim();

            // Strip markdown fences before JSON.parse
            text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            const parsed = JSON.parse(text);

            return {
                rootCause: parsed.rootCause || "AI analysis completed",
                newSelector: parsed.newSelector || null,
                confidence: parsed.confidence || 0.8
            };
        } catch (err) {
            console.error(`  ⚠️ Heal Agent AI Error (key ${apiKey.substring(0, 8)}...):`, err.message);
            // Continue to next key
        }
    }

    return {
        rootCause: "AI API Failure: All API keys exhausted",
        newSelector: null,
        confidence: 0,
    };
}
