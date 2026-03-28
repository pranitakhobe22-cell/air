// Dev 1 - Core Engine: failureWatcher.js
// Captures DOM, logs on failure.
export async function captureFailureContext(page, error, selector, intent, stepHistory) {
  let domSnapshot = '';
  try {
    // Attempt removing huge <svg> or <style> tags to optimize Gemini prompt if needed
    domSnapshot = await page.evaluate(() => {
        let clone = document.documentElement.cloneNode(true);
        clone.querySelectorAll('script, style, svg').forEach(el => el.remove());
        return clone.outerHTML;
    });
  } catch (e) {
    domSnapshot = await page.content();
  }

  return {
      brokenSelector: selector,
      intent,
      domSnapshot,
      errorMsg: error.message,
      lastSteps: stepHistory.slice(-5)
  };
}
