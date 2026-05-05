
const fs = require('fs');
const path = require('path');

const wikiDir = path.join(__dirname, 'wiki', 'projects');
const files = fs.readdirSync(wikiDir).filter(f => f.endsWith('.md'));

const formats = {
  oldFormat: [],
  newFormat: [],
  other: []
};

for (const file of files) {
  const filePath = path.join(wikiDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  if (content.includes('## 📊 基本信息')) {
    formats.newFormat.push(file);
  } else if (content.includes('## 基本信息')) {
    formats.oldFormat.push(file);
  } else {
    formats.other.push(file);
  }
}

console.log('Old format files:', formats.oldFormat.length);
console.log('New format files:', formats.newFormat.length);
console.log('Other format files:', formats.other.length);
console.log();

console.log('=== NEW FORMAT EXAMPLE ===');
if (formats.newFormat.length > 0) {
  console.log(fs.readFileSync(path.join(wikiDir, formats.newFormat[0]), 'utf-8'));
}
console.log();

console.log('=== OLD FORMAT EXAMPLE ===');
if (formats.oldFormat.length > 0) {
  console.log(fs.readFileSync(path.join(wikiDir, formats.oldFormat[0]), 'utf-8'));
}
