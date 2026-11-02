const fs = require('fs');
const filePath = 'pages/projects/[id].tsx';

let content = fs.readFileSync(filePath, 'utf8');

// The file might use CRLF or LF. Let's normalize by split lines:
const isCRLF = content.includes('\r\n');
const lines = content.split(/\r?\n/);

// We need to remove:
// 1) Lines 686 to 711 (index 685 to 710 inclusive)
// 2) Lines 1325 to 1338 (index 1324 to 1337 inclusive)
// 3) Lines 1565 to 1578 (index 1564 to 1577 inclusive)

// Let's filter out these ranges carefully by checking content:
const newLines = [];
let skip1 = false;
let skip2 = false;
let skip3 = false;

for (let i = 0; i < lines.length; i++) {
  const lineNum = i + 1;
  if (lineNum >= 686 && lineNum <= 711) {
    continue;
  }
  if (lineNum >= 1325 && lineNum <= 1338) {
    continue;
  }
  if (lineNum >= 1565 && lineNum <= 1578) {
    continue;
  }
  newLines.push(lines[i]);
}

const updatedContent = newLines.join(isCRLF ? '\r\n' : '\n');
fs.writeFileSync(filePath, updatedContent, 'utf8');
console.log('Successfully updated pages/projects/[id].tsx');

