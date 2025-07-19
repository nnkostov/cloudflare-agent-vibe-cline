// Test script to verify analysis generation is working
const API_BASE = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testAnalysisGeneration() {
  console.log('🧪 Testing Analysis Generation...\n');
  
  // Test repository that likely doesn't have analysis yet
  const testRepo = {
    owner: 'vercel',
    name: 'next.js'
  };
  
  try {
    // First, check if analysis exists
    console.log(`1️⃣ Checking if analysis exists for ${testRepo.owner}/${testRepo.name}...`);
    const checkResponse = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoOwner: testRepo.owner,
        repoName: testRepo.name,
        force: false
      })
    });
    
    const checkData = await checkResponse.json();
    console.log('Check response:', JSON.stringify(checkData, null, 2));
    
    if (checkData.analysis) {
      console.log('✅ Analysis already exists');
    } else {
      console.log('❌ No analysis exists, triggering generation...\n');
      
      // Trigger analysis generation
      console.log(`2️⃣ Triggering analysis generation...`);
      const generateResponse = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoOwner: testRepo.owner,
          repoName: testRepo.name,
          force: true
        })
      });
      
      const generateData = await generateResponse.json();
      console.log('Generation response:', JSON.stringify(generateData, null, 2));
      
      if (generateData.error) {
        console.error('❌ Error generating analysis:', generateData.error);
      } else if (generateData.analysis) {
        console.log('✅ Analysis generated successfully!');
        console.log(`   Investment Score: ${generateData.analysis.investment_score}/100`);
        console.log(`   Recommendation: ${generateData.analysis.recommendation}`);
      } else {
        console.log('⏳ Analysis generation started, would need to poll for results');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAnalysisGeneration();
