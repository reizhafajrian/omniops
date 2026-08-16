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

  content = content.replace(/import\s+{([^}]+)}\s+from\s+['"](@\/api\/client|\.\.\/api\/client)['"]/g, (match, importsStr) => {
    let imports = importsStr.split(',').map(s => s.trim()).filter(Boolean);
    
    let apiImports = [];
    let typeImports = [];
    
    imports.forEach(imp => {
      if (imp === 'api') {
        apiImports.push('systemApi', 'containersApi', 'machinesApi', 'stacksApi');
      } else if (imp.includes('Api')) {
        apiImports.push(imp);
      } else {
        typeImports.push(imp);
      }
    });

    let newImports = [];
    if (apiImports.length > 0) {
      // Determine relative path depth
      const parts = file.split('/');
      let prefix = '@/api';
      if (!match.includes('@/api')) {
          prefix = '../api';
      }
      newImports.push(`import { ${[...new Set(apiImports)].join(', ')} } from '${prefix}';`);
    }
    if (typeImports.length > 0) {
      let prefix = '@/types';
      if (!match.includes('@/api')) {
          prefix = '../types';
      }
      newImports.push(`import { ${typeImports.join(', ')} } from '${prefix}';`);
    }
    
    changed = true;
    return newImports.join('\n');
  });
  
  if (changed || content.includes('api.')) {
    const apiMap = {
      getSettings: 'systemApi',
      updateSettings: 'systemApi',
      getSystemMetrics: 'systemApi',
      getDockerStatus: 'systemApi',
      startDockerDaemon: 'systemApi',
      pruneSystem: 'systemApi',
      
      inspectContainer: 'containersApi',
      getContainerStats: 'containersApi',
      startContainer: 'containersApi',
      stopContainer: 'containersApi',
      restartContainer: 'containersApi',
      deleteContainer: 'containersApi',
      getContainerLogs: 'containersApi',
      
      getMachines: 'machinesApi',
      createMachine: 'machinesApi',
      startMachine: 'machinesApi',
      stopMachine: 'machinesApi',
      deleteMachine: 'machinesApi',
      inspectMachine: 'machinesApi',
      
      getStacks: 'stacksApi',
      getHistory: 'stacksApi',
      getServices: 'stacksApi',
      getCompose: 'stacksApi',
      updateServiceLimits: 'stacksApi',
      cleanStack: 'stacksApi',
      triggerSync: 'stacksApi',
      stopStack: 'stacksApi',
      triggerRollback: 'stacksApi',
      createStack: 'stacksApi',
      updateStack: 'stacksApi',
      deleteStack: 'stacksApi',
      verifyStackPin: 'stacksApi',
    };
    
    for (const [method, apiName] of Object.entries(apiMap)) {
      const regex = new RegExp(`api\\.${method}`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, `${apiName}.${method}`);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
