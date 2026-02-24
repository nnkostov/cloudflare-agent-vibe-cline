// Test the problematic repository that's failing
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testProblematicRepo() {
  console.log('🔍 Testing problematic repository: elder-plinius/L1B3RT4S\n');
  
  try {
    // First, check if we can get the repository details
    console.log('1. Getting repository details from GitHub...');
    const repoResponse = await fetch('https://api.github.com/repos/elder-plinius/L1B3RT4S');
    
    if (!repoResponse.ok) {
      console.log(`   ❌ GitHub API error: ${repoResponse.status}`);
      const error = await repoResponse.text();
      console.log(`   Error: ${error}`);
    } else {
      const repoData = await repoResponse.json();
      console.log(`   ✅ Repository found:`);
      console.log(`      Name: ${repoData.full_name}`);
      console.log(`      Description: ${repoData.description || 'No description'}`);
      console.log(`      Language: ${repoData.language || 'Unknown'}`);
      console.log(`      Stars: ${repoData.stargazers_count}`);
      console.log(`      Topics: ${repoData.topics?.join(', ') || 'None'}`);
    }
    
    // Check README
    console.log('\n2. Checking README availability...');
    const readmeResponse = await fetch('https://api.github.com/repos/elder-plinius/L1B3RT4S/readme');
    
    if (!readmeResponse.ok) {
      console.log(`   ❌ No README found: ${readmeResponse.status}`);
    } else {
      const readmeData = await readmeResponse.json();
      console.log(`   ✅ README found: ${readmeData.size} bytes`);
      
      // Get README content
      const content = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      console.log(`   First 200 chars: ${content.substring(0, 200)}...`);
      
      // Check for special characters or unusual content
      const hasSpecialChars = /[^\x00-\x7F]/.test(content);
      const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(content);
      
      if (hasSpecialChars) {
        console.log('   ⚠️  README contains non-ASCII characters');
      }
      if (hasEmojis) {
        console.log('   ⚠️  README contains emojis');
      }
    }
    
    // Now test the analysis
    console.log('\n3. Testing analysis via API...');
    
    // Get the repo ID first
    const batchResponse = await fetch(`${API_URL}/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'visible',
        force: true,
        chunkSize: 100,
        startIndex: 0
      })
    });
    
    const batchData = await batchResponse.json();
    const targetRepo = batchData.repositories?.find(r => r.full_name === 'elder-plinius/L1B3RT4S');
    
    if (!targetRepo) {
      console.log('   ❌ Repository not found in batch list');
      return;
    }
    
    console.log(`   Found repository in batch: ID=${targetRepo.id}`);
    
    // Try to analyze it
    console.log('\n4. Attempting analysis...');
    const analysisResponse = await fetch(`${API_URL}/analyze/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoId: targetRepo.id,
        repoOwner: targetRepo.owner,
        repoName: targetRepo.name,
        force: true
      })
    });
    
    console.log(`   Response status: ${analysisResponse.status}`);
    const responseText = await analysisResponse.text();
    
    if (!analysisResponse.ok) {
      console.log('   ❌ Analysis failed!');
      console.log(`   Error: ${responseText}`);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(responseText);
        if (errorData.details) {
          console.log('\n   Error details:');
          console.log(`   ${errorData.details}`);
        }
      } catch {}
    } else {
      console.log('   ✅ Analysis successful!');
      try {
        const result = JSON.parse(responseText);
        console.log(`   Analysis model: ${result.analysis?.model_used || 'Unknown'}`);
      } catch {
        console.log('   ⚠️  Response is not valid JSON');
      }
    }
    
    // Test a few other potentially problematic repos
    console.log('\n5. Testing other repositories for comparison...');
    
    const testRepos = [
      'n8n-io/n8n',
      'stefan-jansen/machine-learning-for-trading',
      'diff-usion/Awesome-Diffusion-Models'
    ];
    
    for (const repoName of testRepos) {
      const repo = batchData.repositories?.find(r => r.full_name === repoName);
      if (repo) {
        console.log(`\n   Testing ${repoName}...`);
        const testResponse = await fetch(`${API_URL}/analyze/single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: repo.id,
            repoOwner: repo.owner,
            repoName: repo.name,
            force: false
          })
        });
        
        if (testResponse.ok) {
          console.log(`   ✅ Success`);
        } else {
          const error = await testResponse.text();
          console.log(`   ❌ Failed: ${error}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testProblematicRepo();
