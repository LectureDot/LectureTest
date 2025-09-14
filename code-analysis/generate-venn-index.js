const fs = require('fs');
const path = require('path');

const vennFolder = path.join(__dirname, 'venn');
const indexPath = path.join(vennFolder, 'index.json');

try {
  const files = fs.readdirSync(vennFolder)
    .filter(file => file.endsWith('-venn-data.json'));

  if (files.length === 0) {
    console.warn("⚠️ No Venn JSON files found in", vennFolder);
  } else {
    fs.writeFileSync(indexPath, JSON.stringify(files, null, 2));
    console.log(`✅ Generated index.json with ${files.length} file(s):`);
    files.forEach(file => console.log(`  - ${file}`));
  }
} catch (err) {
  console.error("❌ Failed to generate index.json:", err);
}
