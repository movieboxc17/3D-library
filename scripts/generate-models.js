// run with: node scripts/generate-models.js
const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '..', 'models');
const outFile = path.join(modelsDir, 'models.json');

if(!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

const files = fs.readdirSync(modelsDir).filter(f => f.toLowerCase().endsWith('.fbx'));
const list = files.map(f => ({ name: f, url: 'models/' + f, size: '' }));
fs.writeFileSync(outFile, JSON.stringify(list, null, 2));
console.log('Wrote', outFile, 'with', list.length, 'models');
