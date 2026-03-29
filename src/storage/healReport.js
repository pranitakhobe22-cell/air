import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function writeReport(testFile, stepsHistory) {
    const totalSteps = stepsHistory.length;
    let healsApplied = 0;
    
    // Calculate simple stats
    stepsHistory.forEach(s => {
        if (s.status === 'healed') healsApplied++;
    });

    const report = {
        testFile,
        timestamp: new Date().toISOString(),
        totalSteps,
        healsApplied,
        steps: stepsHistory
    };

    const reportPath = path.join(__dirname, '..', '..', 'heal-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n  📄 healReport written for: ${testFile}`);
}
