const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const input = process.argv[2] || process.env.MERLIN_FRONTEND_DIST;
const version = process.env.MERLIN_FRONTEND_VERSION;
const outputDir = path.join(rootDir, 'frontend');

if (!input) {
    throw new Error('Provide a frontend dist path as an argument or MERLIN_FRONTEND_DIST.');
}

if (!version?.trim()) {
    throw new Error('Set MERLIN_FRONTEND_VERSION to an immutable frontend tag, for example v0.1.0.');
}

const inputDir = path.resolve(input);
const entryPoint = path.join(inputDir, 'index.html');
if (!fs.existsSync(entryPoint)) {
    throw new Error(`Frontend artifact must contain index.html: ${inputDir}`);
}

// `frontend` is a fixed, local staging directory and is intentionally rebuilt
// from an explicit artifact for every packaged release.
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.cpSync(inputDir, outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, '.merlin-frontend.json'), JSON.stringify({
    version: version.trim(),
    copiedAt: new Date().toISOString()
}, null, 2));

console.log(`Frontend ${version.trim()} staged from ${inputDir}.`);
