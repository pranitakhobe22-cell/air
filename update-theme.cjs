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
    let newContent = content
        .replace(/#050B14/g, '#0B0F1A') // Main Dark bg
        .replace(/#070E18/g, '#111827') // Sidebar / Secondary dark bg
        .replace(/cyan-400/g, 'sky-400') // #38BDF8
        .replace(/cyan-500/g, 'sky-500') // matching sky palette
        .replace(/#22d3ee/g, '#38bdf8'); // specific cyan hex replacement

    if (content !== newContent) {
        fs.writeFileSync(file, newContent);
        changedFiles++;
        console.log('Updated:', path.relative(srcDir, file));
    }
});

console.log(`Updated ${changedFiles} files with new color palette.`);
