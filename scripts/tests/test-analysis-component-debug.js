// Test to debug why Analysis component changes aren't working

const fs = require('fs');
const path = require('path');

console.log('=== Analysis Component Debug ===\n');

// Check if the Analysis.tsx file exists and has our changes
const analysisPath = path.join(__dirname, 'dashboard/src/pages/Analysis.tsx');
if (fs.existsSync(analysisPath)) {
  const content = fs.readFileSync(analysisPath, 'utf8');
  
  console.log('✓ Analysis.tsx file exists');
  console.log(`File size: ${content.length} bytes\n`);
  
  // Check for our key changes
  const checks = [
    { name: 'shouldGenerate state', pattern: /const \[shouldGenerate, setShouldGenerate\]/ },
    { name: 'Force refresh useEffect', pattern: /window\.location\.reload\(\)/ },
    { name: 'Generating AI Analysis text', pattern: /Generating AI Analysis/ },
    { name: 'Auto-trigger useEffect', pattern: /No analysis found, triggering generation/ },
    { name: 'generateAnalysisMutation', pattern: /generateAnalysisMutation\.mutate\(\)/ }
  ];
  
  console.log('Checking for key code patterns:');
  checks.forEach(check => {
    const found = check.pattern.test(content);
    console.log(`${found ? '✓' : '✗'} ${check.name}`);
  });
  
  // Check the last build
  const distPath = path.join(__dirname, 'dashboard/dist');
  if (fs.existsSync(distPath)) {
    console.log('\n✓ Build output exists');
    
    // List JS files in dist
    const jsFiles = fs.readdirSync(path.join(distPath, 'assets'))
      .filter(f => f.endsWith('.js') && !f.endsWith('.map'));
    
    console.log('JavaScript bundles:', jsFiles);
    
    // Check if our strings are in the bundle
    if (jsFiles.length > 0) {
      const bundlePath = path.join(distPath, 'assets', jsFiles[0]);
      const bundleContent = fs.readFileSync(bundlePath, 'utf8');
      
      console.log(`\nBundle size: ${(bundleContent.length / 1024 / 1024).toFixed(2)} MB`);
      
      // Check for our unique strings in the bundle
      const bundleChecks = [
        'Generating AI Analysis',
        'No analysis found, triggering generation',
        'Analysis complete, refreshing page'
      ];
      
      console.log('\nChecking bundle for our strings:');
      bundleChecks.forEach(str => {
        const found = bundleContent.includes(str);
        console.log(`${found ? '✓' : '✗'} "${str}"`);
      });
    }
  } else {
    console.log('\n✗ No build output found');
  }
  
} else {
  console.log('✗ Analysis.tsx file not found!');
}

// Check package.json versions
const packagePath = path.join(__dirname, 'package.json');
const dashboardPackagePath = path.join(__dirname, 'dashboard/package.json');

if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  console.log(`\nMain package version: ${pkg.version}`);
}

if (fs.existsSync(dashboardPackagePath)) {
  const pkg = JSON.parse(fs.readFileSync(dashboardPackagePath, 'utf8'));
  console.log(`Dashboard package version: ${pkg.version}`);
}
