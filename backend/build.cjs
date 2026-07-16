const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const outDir = path.join(rootDir, 'dist');

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

fs.copyFileSync(path.join(rootDir, 'index.js'), path.join(outDir, 'index.js'));

const srcDir = path.join(rootDir, 'src');
const outSrcDir = path.join(outDir, 'src');
fs.cpSync(srcDir, outSrcDir, { recursive: true });

console.log(`Build complete: ${outDir}`);
