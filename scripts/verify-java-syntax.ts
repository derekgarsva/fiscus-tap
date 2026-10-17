import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  file: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const PLUGIN_DIR = path.resolve(__dirname, '../android/app/src/main/java/com/fiscus/tap/plugin');
const REQUIRED_FILES = [
  'HceEventBridge.java',
  'HceEventListener.java',
  'HceEventAdapter.java',
  'FiscusHceService.java',
  'FiscusReaderCallback.java',
  'ApduProtocol.java',
  'FiscusNfcPlugin.java',
];

function validatePluginSpecifics(content: string, result: ValidationResult): void {
  // 1. CapacitorPlugin annotation
  if (!/@CapacitorPlugin\s*\(\s*name\s*=\s*"FiscusNfc"\s*\)/.test(content)) {
    result.errors.push('Missing or invalid @CapacitorPlugin(name = "FiscusNfc") annotation');
  }

  // 2. Class declaration
  if (!/public\s+class\s+FiscusNfcPlugin\s+extends\s+Plugin/.test(content)) {
    result.errors.push('Class must declare: public class FiscusNfcPlugin extends Plugin');
  }

  // 3. Required @PluginMethod signatures
  const requiredMethods = [
    { name: 'isSupported', regex: /@PluginMethod\s+public\s+void\s+isSupported\s*\(\s*PluginCall\s+\w+\s*\)/ },
    { name: 'openNfcSettings', regex: /@PluginMethod\s+public\s+void\s+openNfcSettings\s*\(\s*PluginCall\s+\w+\s*\)/ },
    { name: 'startHceSession', regex: /@PluginMethod\s+public\s+void\s+startHceSession\s*\(\s*PluginCall\s+\w+\s*\)/ },
    { name: 'stopHceSession', regex: /@PluginMethod\s+public\s+void\s+stopHceSession\s*\(\s*PluginCall\s+\w+\s*\)/ },
    { name: 'startReaderMode', regex: /@PluginMethod\s+public\s+void\s+startReaderMode\s*\(\s*PluginCall\s+\w+\s*\)/ },
    { name: 'stopReaderMode', regex: /@PluginMethod\s+public\s+void\s+stopReaderMode\s*\(\s*PluginCall\s+\w+\s*\)/ },
  ];

  for (const m of requiredMethods) {
    if (!m.regex.test(content)) {
      result.errors.push(`Missing required plugin method: @PluginMethod public void ${m.name}(PluginCall call)`);
    }
  }

  // 4. Lifecycle hooks
  if (!/public\s+void\s+load\s*\(\s*\)/.test(content)) {
    result.errors.push('Missing lifecycle hook: public void load()');
  }
  if (!/protected\s+void\s+handleOnDestroy\s*\(\s*\)/.test(content)) {
    result.errors.push('Missing lifecycle hook: protected void handleOnDestroy()');
  }

  // 5. HceEventBridge coupling
  if (!content.includes('HceEventBridge.getInstance().addListener')) {
    result.errors.push('load() must register listener via HceEventBridge.getInstance().addListener(...)');
  }
  if (!content.includes('HceEventBridge.getInstance().removeListener')) {
    result.errors.push('handleOnDestroy() must unregister listener via HceEventBridge.getInstance().removeListener(...)');
  }

  // 6. OS Priority gating
  if (!content.includes('HceEventBridge.enableForegroundPriority') || !content.includes('HceEventBridge.disableForegroundPriority')) {
    result.errors.push('Must use HceEventBridge.enableForegroundPriority / disableForegroundPriority for OS conflict elimination');
  }

  // 7. UI Thread execution for reader mode
  if (!content.includes('runOnUiThread')) {
    result.errors.push('Reader mode start/stop must be executed on Activity UI thread via runOnUiThread');
  }

  // 8. Event notification
  const requiredEvents = ['onTagDiscovered', 'onHcePayloadSent', 'onReaderError'];
  for (const evt of requiredEvents) {
    if (!content.includes(`"${evt}"`)) {
      result.errors.push(`Missing notifyListeners call for event "${evt}"`);
    }
  }
}

export function verifyJavaFiles(): { allPassed: boolean; results: ValidationResult[] } {
  const results: ValidationResult[] = [];
  let allPassed = true;

  for (const filename of REQUIRED_FILES) {
    const filePath = path.join(PLUGIN_DIR, filename);
    const result: ValidationResult = { file: filename, passed: true, errors: [], warnings: [] };

    if (!fs.existsSync(filePath)) {
      result.passed = false;
      result.errors.push(`File missing: ${filePath}`);
      results.push(result);
      allPassed = false;
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Package declaration
    if (!content.includes('package com.fiscus.tap.plugin;')) {
      result.passed = false;
      result.errors.push('Missing or invalid package statement: package com.fiscus.tap.plugin;');
    }

    // 2. Wildcard imports
    const wildcardMatches = content.match(/import\s+[a-zA-Z0-9_.]+\.\*;/g);
    if (wildcardMatches) {
      result.passed = false;
      result.errors.push(`Wildcard imports forbidden: ${wildcardMatches.join(', ')}`);
    }

    // 3. Balanced braces
    let braceCount = 0;
    for (const char of content) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
    if (braceCount !== 0) {
      result.passed = false;
      result.errors.push(`Unbalanced curly braces (balance: ${braceCount})`);
    }

    // 4. Plugin-specific validation for FiscusNfcPlugin.java
    if (filename === 'FiscusNfcPlugin.java') {
      validatePluginSpecifics(content, result);
    }

    if (result.errors.length > 0) {
      result.passed = false;
      allPassed = false;
    }
    results.push(result);
  }

  return { allPassed, results };
}

// Standalone execution
if (require.main === module || !module.parent) {
  const { allPassed, results } = verifyJavaFiles();
  console.log('========================================================================');
  console.log('       Fiscus Tap — Android Java Static Syntax & AST Verifier           ');
  console.log('========================================================================\n');

  for (const r of results) {
    const status = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${status}] ${r.file}`);
    if (r.errors.length > 0) {
      for (const err of r.errors) {
        console.error(`       Error: ${err}`);
      }
    }
  }

  console.log('\n========================================================================');
  if (allPassed) {
    console.log(`ALL JAVA FILES VERIFIED SUCCESSFULLY (${results.length}/${REQUIRED_FILES.length})`);
    process.exit(0);
  } else {
    console.error('JAVA VALIDATION FAILED');
    process.exit(1);
  }
}
