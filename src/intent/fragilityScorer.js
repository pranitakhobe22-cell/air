import fs from 'fs';

// Phase 4: Intent Layer - evaluates fragility of selectors dynamically
export function scoreFragility(testFile) {
    if (!fs.existsSync(testFile)) return;

    const content = fs.readFileSync(testFile, 'utf-8');
    
    // Naively extract strings inside heal...()
    const regex = /heal(?:Click|Fill|Navigate)\(\s*page\s*,\s*['"](.*?)['"]/g;
    const matches = [...content.matchAll(regex)];
    
    if(matches.length === 0) return;

    console.log('  ⚠️  Pre-Run Fragility Score Analysis:');
    
    matches.forEach(m => {
        const sel = m[1];
        let score = 0;
        let reasons = [];

        if (sel.includes('>')) { score+=40; reasons.push('Relies on exact DOM parent/child structure (> modifier)'); }
        if (sel.includes(':nth-child')) { score+=60; reasons.push('Uses ultra-fragile index indexing (:nth-child)'); }
        if (sel.startsWith('/')) { score+=80; reasons.push('XPath is fundamentally brittle to DOM modifications'); }
        if (sel.split(' ').length > 2) { score+=20; reasons.push('Deeply nested combination path'); }

        if (sel.startsWith('#')) { score = Math.max(0, score - 50); reasons.push('ID attributes provide strong resistance'); }

        score = Math.min(100, Math.max(0, score));

        let color = score > 50 ? '\x1b[31m' : (score > 20 ? '\x1b[33m' : '\x1b[32m'); // Red : Yellow : Green
        let reset = '\x1b[0m';
        
        console.log(`     ${sel} ➔ Fragility: ${color}${score}%${reset}`);
        reasons.forEach(r => console.log(`        - ${r}`));
    });

    console.log(''); // spacer
}
