export default {
  // Test directory to scan
  testDir: './tests',
  
  // High timeout required for AI inference
  timeout: 60000,
  
  // Gemini AI Healer settings
  healer: {
    model: 'gemini-2.5-flash',
    confidenceThreshold: 0.80,
  },
  
  // Live Dashboard settings
  dashboard: {
    port: 3000,
    openOnStart: true
  }
};
