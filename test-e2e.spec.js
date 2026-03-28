import { healClick } from './src/sdk/healClick.js';

export default async function run(page) {
    console.log("    --> Navigating to intentionally broken test page...");
    
    // Create a local page with a known DOM structure
    const html = `
        <html>
            <body>
                <div class="header">End to End Test</div>
                <!-- This button is the target, but its class is completely different. -->
                <button class="new-purchase-btn" aria-label="confirm">Buy Now</button>
            </body>
        </html>
    `;
    
    // Load the HTML directly into Playwright
    await page.goto(`data:text/html,${encodeURIComponent(html)}`);

    console.log("    --> Clicking intentionally broken selector: 'button:has-text('Buy Now')'");
    await healClick(page, 'button:has-text('Buy Now')', { intent: "Click Buy Now" });

    // Fragile selector for testing panel
    console.log("    --> Clicking a deep fragile selector...");
    await healClick(page, 'button.new-purchase-btn');
    
    console.log("    --> Test Complete! We clicked the button and survived a broken selector!");
}
