// Test script to debug analysis loading behavior
const API_BASE_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testAnalysisLoading(owner, repo) {
  console.log(`\n🔍 Testing analysis loading for ${owner}/${repo}`);
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Check if analysis exists (without forcing generation)
    console.log('\n1️⃣ Checking if analysis exists...');
    const checkResponse = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        repoOwner: owner, 
        repoName: repo, 
        force: false 
      })
    });
    
    const checkData = await checkResponse.json();
    console.log('Response status:', checkResponse.status);
    console.log('Response data:', JSON.stringify(checkData, null, 2));
    
    if (checkData.analysis) {
      console.log('✅ Analysis already exists');
      return;
    }
    
    // Step 2: Trigger generation
    console.log('\n2️⃣ Triggering analysis generation...');
    const generateResponse = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        repoOwner: owner, 
        repoName: repo, 
        force: true 
      })
    });
    
    const generateData = await generateResponse.json();
    console.log('Response status:', generateResponse.status);
    console.log('Response data:', JSON.stringify(generateData, null, 2));
    
    // Step 3: Poll for results
    if (!generateData.analysis) {
      console.log('\n3️⃣ Polling for results...');
      let attempts = 0;
      const maxAttempts = 20;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
        
        console.log(`\nPoll attempt ${attempts}/${maxAttempts}...`);
        const pollResponse = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            repoOwner: owner, 
            repoName: repo, 
            force: false 
          })
        });
        
        const pollData = await pollResponse.json();
        console.log('Poll response:', JSON.stringify(pollData, null, 2));
        
        if (pollData.analysis) {
          console.log('✅ Analysis completed!');
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test with a repository that likely doesn't have analysis
testAnalysisLoading('facebook', 'react');
