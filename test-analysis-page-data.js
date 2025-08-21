// Test script to verify analysis page data is complete
const API_BASE_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testAnalysisEndpoint(owner, repo) {
  console.log(`\n🔍 Testing analysis endpoint for ${owner}/${repo}...`);
  
  try {
    // Test the analyze endpoint
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoOwner: owner,
        repoName: repo,
        force: false
      })
    });

    if (!response.ok) {
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return;
    }

    const data = await response.json();
    console.log('\n✅ API Response received');
    
    // Check if we have both analysis and repository data
    console.log('\n📊 Data Structure Check:');
    console.log('- Has analysis data:', !!data.analysis);
    console.log('- Has repository data:', !!data.repository);
    
    if (data.analysis) {
      console.log('\n📈 Analysis Scores:');
      console.log('- Investment Score:', data.analysis.scores?.investment || 'MISSING');
      console.log('- Innovation Score:', data.analysis.scores?.innovation || 'MISSING');
      console.log('- Team Score:', data.analysis.scores?.team || 'MISSING');
      console.log('- Market Score:', data.analysis.scores?.market || 'MISSING');
      console.log('- Recommendation:', data.analysis.recommendation || 'MISSING');
      console.log('- Model Used:', data.analysis.metadata?.model || 'MISSING');
      console.log('- Analyzed At:', data.analysis.metadata?.timestamp || 'MISSING');
    }
    
    if (data.repository) {
      console.log('\n📦 Repository Data:');
      console.log('- ID:', data.repository.id || 'MISSING');
      console.log('- Full Name:', data.repository.full_name || 'MISSING');
      console.log('- Description:', data.repository.description || 'No description');
      console.log('- Stars:', data.repository.stars || 'MISSING');
      console.log('- Language:', data.repository.language || 'MISSING');
      console.log('- Topics:', data.repository.topics?.join(', ') || 'No topics');
    }
    
    // Check for missing critical fields
    const missingFields = [];
    if (!data.analysis?.scores?.investment) missingFields.push('investment score');
    if (!data.analysis?.scores?.innovation) missingFields.push('innovation score');
    if (!data.analysis?.scores?.team) missingFields.push('team score');
    if (!data.analysis?.scores?.market) missingFields.push('market score');
    if (!data.repository?.description && data.repository?.description !== null) missingFields.push('repository description');
    
    if (missingFields.length > 0) {
      console.log('\n⚠️  Missing fields:', missingFields.join(', '));
    } else {
      console.log('\n✅ All critical fields are present!');
    }
    
    // Test the frontend URL
    const frontendUrl = `https://github-ai-intelligence.nkostov.workers.dev/analysis/${owner}/${repo}`;
    console.log(`\n🌐 Frontend URL: ${frontendUrl}`);
    console.log('Visit this URL to see if the data displays correctly.');
    
  } catch (error) {
    console.error('❌ Error testing analysis endpoint:', error);
  }
}

// Test with the example repository
console.log('🚀 Starting Analysis Page Data Test');
console.log('=====================================');

testAnalysisEndpoint('wshobson', 'agents').then(() => {
  console.log('\n=====================================');
  console.log('✅ Test completed!');
});
