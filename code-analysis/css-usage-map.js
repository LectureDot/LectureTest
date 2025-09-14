const fs = require('fs');
const path = require('path');

const HTML_EXTENSIONS = ['.html', '.js', '.jsx'];
const CSS_EXTENSIONS = ['.css'];

const getAllFiles = (dirPath, arrayOfFiles = []) => {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
};

const extractClassesFromHTML = (content, source) => {
  const classRegex = /class(Name)?\s*=\s*["']([^"']+)["']/g;
  const results = [];

  let match;
  while ((match = classRegex.exec(content)) !== null) {
    const classes = match[2].split(/\s+/);
    classes.forEach(cls => {
      results.push({ class: cls, source });
    });
  }

  return results;
};

const extractClassesFromCSS = (content, file) => {
  const cssRegex = /\.([\w-]+)[\s,{]/g;
  const results = [];

  let match;
  while ((match = cssRegex.exec(content)) !== null) {
    results.push({ class: match[1], file });
  }

  return results;
};

const main = () => {
  const projectRoot = './'; // you can change this
  const allFiles = getAllFiles(projectRoot);

  const htmlFiles = allFiles.filter(file => HTML_EXTENSIONS.includes(path.extname(file)));
  const cssFiles = allFiles.filter(file => CSS_EXTENSIONS.includes(path.extname(file)));

  const htmlClasses = [];
  const cssClasses = [];

  htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    htmlClasses.push(...extractClassesFromHTML(content, file));
  });

  cssFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    cssClasses.push(...extractClassesFromCSS(content, file));
  });

  const cssClassMap = new Map();
  cssClasses.forEach(({ class: cls, file }) => {
    if (!cssClassMap.has(cls)) cssClassMap.set(cls, []);
    cssClassMap.get(cls).push(file);
  });

  console.log('\n🔍 Class Usage Map:\n');

  const usedClasses = new Set();

  htmlClasses.forEach(({ class: cls, source }) => {
    if (cssClassMap.has(cls)) {
      usedClasses.add(cls);
      const cssFiles = cssClassMap.get(cls).join(', ');
      console.log(`✅ ${source}: class "${cls}" → CSS: ${cssFiles}`);
    } else {
      console.log(`⚠️  ${source}: class "${cls}" → ❌ NOT FOUND in CSS`);
    }
  });

  console.log('\n🧹 Unused CSS Classes:\n');
  cssClassMap.forEach((files, cls) => {
    if (!usedClasses.has(cls)) {
      console.log(`🚫 .${cls} → NOT USED in any HTML/JS file`);
    }
  });
};

main();
