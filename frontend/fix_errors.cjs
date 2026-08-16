const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('src');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  // Fix getStoredToken / setStoredToken
  if (content.includes('getStoredToken') || content.includes('setStoredToken')) {
    // Remove from types import
    content = content.replace(/import\s+{([^}]*(?:getStoredToken|setStoredToken)[^}]*)}\s+from\s+['"]([^'"]+)['"]/g, (match, p1, p2) => {
        if (p2.includes('types')) {
            let parts = p1.split(',').map(s => s.trim()).filter(Boolean);
            let kept = [];
            let tokens = [];
            parts.forEach(p => {
                if (p === 'getStoredToken' || p === 'setStoredToken') {
                    tokens.push(p);
                } else {
                    kept.push(p);
                }
            });
            changed = true;
            
            let res = '';
            if (kept.length > 0) {
                res += `import { ${kept.join(', ')} } from '${p2}';\n`;
            }
            if (tokens.length > 0) {
                let clientPath = p2.replace('types', 'api/client');
                res += `import { ${tokens.join(', ')} } from '${clientPath}';`;
            }
            return res;
        }
        return match;
    });
  }

  // Remove unused API imports
  const apis = ['systemApi', 'containersApi', 'machinesApi', 'stacksApi'];
  apis.forEach(api => {
    // Check if imported
    const importRegex = new RegExp(`import\\s+{[^}]*\\b${api}\\b[^}]*}\\s+from\\s+['"](?:@|\\.\\.)\\/api['"]`);
    if (importRegex.test(content)) {
        // Check if used anywhere else than the import itself
        const matches = content.match(new RegExp(`\\b${api}\\b`, 'g')) || [];
        if (matches.length === 1) { // Only the import
            // Remove it from the import list
            content = content.replace(importRegex, (match) => {
                let clean = match.replace(new RegExp(`\\b${api}\\b,?`), '').replace(/,\s*}/, '}').replace(/{\s*,/, '{').replace(/{\s*}/, '');
                if (clean.includes('import  from')) return ''; // empty import
                if (clean.includes('import {  } from')) return ''; // empty import
                changed = true;
                return clean;
            });
        }
    }
  });
  
  if (content.includes('import { StacksResponse, HistoryResponse, ActionResponse } from \'../types\';')) {
      content = content.replace('import { StacksResponse, HistoryResponse, ActionResponse } from \'../types\';', 'import { StacksResponse, HistoryResponse, ActionResponse } from \'../types\';\n');
  }

  if (file.endsWith('api/client.ts')) {
    content = content.replace(/import\s+{([^}]*)}\s+from\s+['"]\.\.\/types['"];?/, '');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
