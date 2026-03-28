export function scanDomForHeal(failureBundle) {
    const { selector, domSnapshot, intent } = failureBundle;
    
    let newSelector = null;
    let confidence = 0;
    let rootCause = "Local scanner checked";

    if (!domSnapshot || !selector) {
        return { rootCause: "Missing DOM or selector", newSelector, confidence };
    }

    // Strip HTML comments and <script> blocks so commented-out selectors
    // (e.g. "<!-- old id was email-input -->") don't cause false-positive matches
    const cleanDom = domSnapshot
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '');

    // ── Intent-Aware Heuristics (highest priority) ──
    // If the test author provided an intent like "Click the Buy Now button",
    // we extract keywords and search for them in id attrs, aria-labels, and text.
    if (intent && typeof intent === 'string') {
        const intentWords = intent
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3); // skip short words like "the", "a"

        // Non-actionable tags — text matches inside these are unreliable for fill/click
        const nonActionableTags = ['label', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'td', 'th'];

        for (const word of intentWords) {
            // 1. Check id attributes containing the intent keyword (most reliable)
            const idMatch = cleanDom.match(new RegExp(`id="([^"]*${word}[^"]*)"`, 'i'));
            if (idMatch) {
                const candidate = `#${idMatch[1]}`;
                if (candidate !== selector) {
                    newSelector = candidate;
                    confidence = 0.95;
                    rootCause = `Intent keyword "${word}" matched id="${idMatch[1]}"`;
                    return { rootCause, newSelector, confidence };
                }
            }

            // 2. Check aria-label containing the intent keyword
            const ariaMatch = cleanDom.match(new RegExp(`aria-label="([^"]*${word}[^"]*)"`, 'i'));
            if (ariaMatch) {
                const candidate = `[aria-label="${ariaMatch[1]}"]`;
                if (candidate !== selector) {
                    newSelector = candidate;
                    confidence = 0.93;
                    rootCause = `Intent keyword "${word}" matched aria-label="${ariaMatch[1]}"`;
                    return { rootCause, newSelector, confidence };
                }
            }

            // 3. Check visible text content — but skip non-actionable elements
            const textRegex = new RegExp(`<(\\w+)[^>]*>([^<]*${word}[^<]*)<`, 'gi');
            let textMatch;
            while ((textMatch = textRegex.exec(cleanDom)) !== null) {
                const tag = textMatch[1].toLowerCase();
                const visibleText = textMatch[2].trim();
                // Skip if the tag is non-actionable (label, span, p, etc.)
                if (nonActionableTags.includes(tag)) continue;
                if (visibleText.length > 0 && visibleText.length < 60) {
                    newSelector = `text="${visibleText}"`;
                    confidence = 0.88;
                    rootCause = `Intent keyword "${word}" found in <${tag}> text "${visibleText}"`;
                    return { rootCause, newSelector, confidence };
                }
            }
        }
    }

    // ── Selector-Keyword Heuristics (fallback) ──
    // Strips punctuation from the selector to find keywords.
    const cleanWord = selector.replace(/[.#>\[\]="']/g, ' ').trim().split(' ')[0] || '';
    
    if (!cleanWord) return { rootCause, newSelector, confidence };

    // 1. Check for text content fallback
    if (cleanDom.includes(`>${cleanWord}<`)) {
        newSelector = `text="${cleanWord}"`;
        confidence = 0.85;
        rootCause = `Exact text match found for "${cleanWord}" avoiding structural selector`;
    } 
    // 2. Check aria-label
    else if (cleanDom.includes(`aria-label="${cleanWord}"`)) {
        newSelector = `[aria-label="${cleanWord}"]`;
        confidence = 0.92;
        rootCause = `Direct aria-label match found for "${cleanWord}"`;
    }
    // 3. Partial class match check
    else if (cleanDom.includes(`class="${cleanWord}`)) {
        newSelector = `.${cleanWord}`;
        confidence = 0.81; // Just above 0.8 threshold
        rootCause = `Found partial semantic class "${cleanWord}"`;
    }

    // Safety guard: never return a "healed" selector identical to the broken one
    if (newSelector === selector) {
        return { rootCause: "Local engine matched same selector — deferring to AI", newSelector: null, confidence: 0 };
    }

    return { rootCause, newSelector, confidence };
}
