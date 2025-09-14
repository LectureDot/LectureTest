const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..'); // points to `src/`
console.log(projectRoot)
const outputDir = './madge-mock';

const HTML_EXTENSIONS = ['.html', '.js', '.jsx'];
const CSS_EXTENSIONS = ['.css'];

const EXCLUDE_DIRS = ['code-analysis'];

const getAllFiles = (dirPath, arrayOfFiles = []) => {
  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(projectRoot, fullPath);

    // Skip excluded directories
    if (fs.statSync(fullPath).isDirectory()) {
      if (!EXCLUDE_DIRS.some(excluded => relativePath.startsWith(excluded))) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
};

const removeBlockComments = (content) => {
    return content.replace(/\/\*[\s\S]*?\*\//g, '');
  };

const extractClassesFromCode = (content) => {
    // Remove block comments: /* ... */
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove single-line comments: // ...
  content = content.replace(/\/\/.*/g, '');

  const classRegexes = [
    /class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g,                      // class="a b", className='x'
    /class(?:Name)?\s*:\s*["'`]([^"'`]+)["'`]/g,                      // { className: 'foo' }
    /\.class(?:Name)?\s*=\s*["'`]([^"'`]+)["'`]/g,                    // el.className = 'bar'
    /newEl\s*\(\s*\{\s*[^}]*class(?:Name)?\s*:\s*["'`]([^"'`]+)["'`]/g, // newEl({ className: "abc" })
    /\.classList\.(?:add|remove|toggle)\s*\(([^)]+)\)/g              // el.classList.add("a", "b")
  ];

  const classes = new Set();

  for (const regex of classRegexes) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const rawGroup = match[1];
      if (!rawGroup) continue;

      // Handle .classList.add("a", "b") => split on quotes and commas
      const classCandidates = rawGroup
        .split(/[\s,'"``]+/)                 // split on whitespace, commas, quotes
        .map(cls => cls.trim())
        .filter(cls =>
          /^[a-zA-Z_-][\w-]*$/.test(cls) &&  // valid class name
          !/^\d+$/.test(cls)                // skip pure numbers
        );

      classCandidates.forEach(cls => {
        if (cls) classes.add(cls);
      });
    }
  }

  return Array.from(classes);
};
  
  const extractCSSClassNames = (content) => {
    const classNames = new Set();

  // Strip block comments: /* ... */
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');

  // Strip single-line comments: // ...
  content = content.replace(/\/\/.*/g, '');

  // Match CSS class selectors only in proper selector contexts
  const regex = /(?:^|\s|,)\.([a-zA-Z_-][a-zA-Z0-9_-]*)\b/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const cls = match[1];

    // Skip class names that are purely numeric
    if (!/^\d+$/.test(cls)) {
      classNames.add(cls);
    }
  }

  return Array.from(classNames);
};

// Function to compare JS classes with CSS classes and find missing ones
const findMissingClasses = (jsFiles, cssFiles) => {
    const cssClasses = new Set();
  
    // Extract all classes from CSS files
    cssFiles.forEach(cssFilePath => {
      const cssContent = fs.readFileSync(cssFilePath, 'utf-8');
      const classesInCSS = extractCSSClassNames(cssContent);
      classesInCSS.forEach(cls => cssClasses.add(cls));
    });
  
    const missingClasses = {};
  
    jsFiles.forEach(jsFilePath => {
      const jsContent = fs.readFileSync(jsFilePath, 'utf-8');
      const usedClasses = extractClassesFromCode(jsContent);
  
      // Find which JS classes are missing in CSS
      usedClasses.forEach(cls => {
        if (!cssClasses.has(cls)) {
          if (!missingClasses[jsFilePath]) {
            missingClasses[jsFilePath] = [];
          }
          missingClasses[jsFilePath].push(cls);
        }
      });
    });
  
    return missingClasses;
  };


  const buildMadgeMockFiles = () => {
    // Clean & recreate output dir
    if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true });
    fs.mkdirSync(outputDir);

    const allFiles = getAllFiles(projectRoot);
    const htmlFiles = allFiles.filter(f => HTML_EXTENSIONS.includes(path.extname(f)));
    const cssFiles = allFiles.filter(f => CSS_EXTENSIONS.includes(path.extname(f)));
    
    const missingClasses = findMissingClasses(htmlFiles, cssFiles);
    console.log('Missing Classes (not in CSS):', missingClasses);
  
    // Get all CSS class names from CSS files
    const cssClassMap = new Set();
    const cssClassesDefined = new Set();  // To track defined classes (for unused class detection)
    cssFiles.forEach(cssPath => {
      const css = fs.readFileSync(cssPath, 'utf8');
      const cleaned = removeBlockComments(css);
      extractCSSClassNames(cleaned).forEach(cls => {
        cssClassMap.add(cls);
        cssClassesDefined.add(cls); // Track all defined classes
        console.log(`Class:`, cssPath, cls);
      });
    });
  
    // Create mock files only for used CSS classes that are defined in the CSS
    htmlFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      const usedClasses = extractClassesFromCode(content);
      
      // Only keep classes that are found in the CSS files
      const filtered = usedClasses.filter(cls => cssClassMap.has(cls));
  
      if (filtered.length > 0) {
        const fileName = path.basename(filePath).replace(/\W/g, '_') + '.js';
        const mockContent = filtered.map(cls => `require("./.${cls}");`).join('\n');
        console.log(`Classes in ${filePath}:`, filtered);
  
        fs.writeFileSync(path.join(outputDir, fileName), mockContent);

        // Prepare sets
        const cssSet = new Set(cssClassMap);          // Classes defined in CSS
        const usedSet = new Set(usedClasses);         // Classes used in JS/HTML
        const missingSet = new Set([...usedSet].filter(cls => !cssSet.has(cls))); // Used but missing in CSS
        const cssUsed = new Set([...cssSet].filter(cls => usedSet.has(cls)));     // Used and in CSS

        // Unique sets for the Venn diagram
        const onlyCSS = [...cssSet].filter(cls => !usedSet.has(cls));
        const onlyUsed = [...usedSet].filter(cls => !cssSet.has(cls));
        const shared = [...cssUsed];

        // Format for venn.js
        const vennData = [
          {
            sets: ["CSS"],
            size: onlyCSS.length,
           // x: 0.5, // x-coordinate for the CSS circle
           // y: 0.5, // y-coordinate for the CSS circle
            classes: onlyCSS
          },
          {
            sets: ["Used"],
            size: onlyUsed.length,
           // x: 1.5, // x-coordinate for the Used circle
           // y: 0.5, // y-coordinate for the Used circle
            classes: onlyUsed
          },
          {
            sets: ["CSS", "Used"],
            size: shared.length,
           //x: 1.0, // x-coordinate for the intersection of CSS and Used circles
          // y: 0.5, // y-coordinate for the intersection of CSS and Used circles
            classes: shared
          }
        ];
      
        // Write to file with proper filename
        const vennFileName = path.basename(filePath).replace(/\.[^/.]+$/, '') + '-venn-data.json';
        const vennFilePath = path.join(projectRoot, 'code-analysis', 'venn', vennFileName);

        fs.writeFileSync(
          vennFilePath,
          JSON.stringify(vennData, null, 2)
        );
        }
    });
  
    // Create mock files for all defined CSS classes (even if unused)
    cssClassMap.forEach(cls => {
      const mockPath = path.join(outputDir, `.${cls}.js`);
      if (!fs.existsSync(mockPath)) {
        // If the class is unused, mark it as such in the file content
        const isUsed = [...htmlFiles].some(filePath => {
          const content = fs.readFileSync(filePath, 'utf8');
          return content.includes(cls); // Check if class is used in the file
        });
  
        // Mark unused classes
        const mockContent = isUsed 
          ? `// CSS class: .${cls} (used)`
          : `// CSS class: .${cls} (unused)`;
  
        fs.writeFileSync(mockPath, mockContent);
      }
    });
  
    const allUsedClasses = new Set(); // new set to collect all used classes
    htmlFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      extractClassesFromCode(content).forEach(cls => allUsedClasses.add(cls));
    });
  
    const isValidClassName = (name) =>
      /^[a-zA-Z_-][\w-]*$/.test(name) && !/^\d+$/.test(name);
    
    // Check for any used classes that are valid but don't exist in CSS
    allUsedClasses.forEach(cls => {
      if (!isValidClassName(cls)) return;
    
      const mockPath = path.join(outputDir, `.${cls}.js`);
      if (!fs.existsSync(mockPath) && cssClassMap.has(cls)) {
        fs.writeFileSync(mockPath, `// Class: .${cls}`);
      }
    });
  
    console.log(`✅ Mock files created in ${outputDir}`);
  };

buildMadgeMockFiles();
