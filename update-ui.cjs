const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk(srcDir);
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add hover elevation "hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-300"
    let newContent = content
        .replace(/hover:bg-slate-900\/60 transition-all/g, 'hover:-translate-y-1 hover:shadow-2xl hover:shadow-sky-500/10 hover:bg-[#111827]/80 transition-all duration-300')
        .replace(/bg-slate-900\/40/g, 'bg-[#111827]/60 backdrop-blur-xl')
        .replace(/bg-slate-900\/20/g, 'bg-[#111827]/40 backdrop-blur-md')
        .replace(/bg-slate-950\/50/g, 'bg-[#0B0F1A]/80 backdrop-blur-2xl')
        .replace(/shadow-\[0_0_8px_rgba\(16\,185\,129\,0\.5\)\]/g, 'shadow-[0_0_15px_rgba(16,185,129,0.8)]') // Enhanced glow
        .replace(/shadow-\[0_0_8px_rgba\(16\,185\,129\,0\.6\)\]/g, 'shadow-[0_0_15px_rgba(16,185,129,0.8)]') // Enhanced glow
        .replace(/bg-slate-800\/50/g, 'bg-[#111827]/50');

    if (content !== newContent) {
        fs.writeFileSync(file, newContent);
        changedFiles++;
    }
});

console.log(`Updated hover elevations and glassmorphism glows in ${changedFiles} files.`);
