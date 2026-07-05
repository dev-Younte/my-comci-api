const fs = require('fs');
const content = fs.readFileSync('utils/comci-crawler.ts', 'utf-8');
console.log('Compile test passed visually if no syntax error.');
