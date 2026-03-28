import fs from 'fs';
import chalk from 'chalk';

// Phase 4: Intent Layer - evaluates fragility of selectors dynamically
export function scoreFragility(testFile) {
    if (!fs.existsSync(testFile)) return [];

    const content = fs.readFileSync(testFile, 'utf-8');
    
    // Naively extract strings inside heal...()
    const regex = /heal(?:Click|Fill|Navigate)\(\s*page\s*,\s*['"](.*?)['"]/g;
    const matches = [...content.matchAll(regex)];
    
    if(matches.length === 0) return [];

    const scores = [];
    console.log(chalk.bold.yellow('\n  ⚠️  Pre-Run Fragility Score Analysis:'));
    
    matches.forEach(m => {
        const sel = m[1];
        let score = 0;
        let reasons = [];

        if (sel.includes('>')) { score += 40; reasons.push('Relies on exact DOM parent/child structure (> modifier)'); }
        if (sel.includes(':nth-child')) { score += 60; reasons.push('Uses ultra-fragile index indexing (:nth-child)'); }
        if (sel.startsWith('/')) { score += 80; reasons.push('XPath is fundamentally brittle to DOM modifications'); }
        if (sel.split(' ').length > 2) { score += 20; reasons.push('Deeply nested combination path'); }

        if (sel.startsWith('#')) { 
            score = Math.max(0, score - 50); 
            reasons.push('ID attributes provide strong resistance'); 
        }

        scores.push({ selector: sel, score, reasons });
        
        const color = score > 50 ? chalk.red : (score > 20 ? chalk.yellow : chalk.green);
        console.log(`     ${chalk.cyan(sel)} ➔ Fragility: ${color(`${score}%`)}`);
        reasons.forEach(r => console.log(`        - ${chalk.dim(r)}`));
    });

    console.log(''); // spacer
    return scores;
}
