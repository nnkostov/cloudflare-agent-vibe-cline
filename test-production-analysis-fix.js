// Test script to verify the analysis page fix in production
const PRODUCTION_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function testAnalysisEndpoint(owner, repo) {
  console.log(`\n🔍 Testing analysis endpoint for ${owner}/${repo}...`);
  
  try {
    const response = await fetch(`${PRODUCTION_URL}/api/analyze/${owner}/${repo}`);
    const data = await response.json();
    
    console.log(`📊 Response status: ${response.status}`);
    console.log(`📦 Response structure:`);
    console.log(`  - Has analysis object: ${!!data.analysis}`);
    console.log(`  - Has repository object: ${!!data.repository}`);
    
    if (data.analysis) {
      console.log(`\n✅ Analysis data:`);
      console.log(`  - ID: ${data.analysis.id}`);
      console.log(`  - Created: ${new Date(data.analysis.created_at).toLocaleString()}`);
      console.log(`  - Has scores: ${!!data.analysis.scores}`);
      
      if (data.analysis.scores) {
        console.log(`  - Innovation Score: ${data.analysis.scores.innovation_score}`);
        console.log(`  - Popularity Score: ${data.analysis.scores.popularity_score}`);
        console.log(`  - Maintenance Score: ${data.analysis.scores.maintenance_score}`);
        console.log(`  - Community Score: ${data.analysis.scores.community_score}`);
        console.log(`  - Documentation Score: ${data.analysis.scores.documentation_score}`);
      }
    }
    
    if (data.repository) {
      console.log(`\n✅ Repository data:`);
      console.log(`  - Name: ${data.repository.name}`);
      console.log(`  - Description: ${data.repository.description || 'No description'}`);
      console.log(`  - Stars: ${data.repository.stars}`);
      console.log(`  - Language: ${data.repository.language}`);
      console.log(`  - Tier: ${data.repository.tier}`);
    }
    
    // Check if all required fields are present
    const hasAllScores = data.analysis?.scores && 
      data.analysis.scores.innovation_score !== undefined &&
      data.analysis.scores.popularity_score !== undefined &&
      data.analysis.scores.maintenance_score !== undefined &&
      data.analysis.scores.community_score !== undefined &&
      data.analysis.scores.documentation_score !== undefined;
    
    const hasRepositoryInfo = data.repository?.name && 
      data.repository?.stars !== undefined;
    
    if (hasAllScores && hasRepositoryInfo) {
      console.log(`\n✅ SUCCESS: All required data is present!`);
      return true;
    } else {
      console.log(`\n❌ MISSING DATA:`);
      if (!hasAllScores) console.log(`  - Missing some scores`);
      if (!hasRepositoryInfo) console.log(`  - Missing repository information`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error testing ${owner}/${repo}:`, error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Testing Analysis Page Fix in Production');
  console.log('==========================================');
  
  const testCases = [
    { owner: 'tensorflow', repo: 'tensorflow' },
    { owner: 'wshobson', repo: 'agents' },
    { owner: 'langchain-ai', repo: 'langchain' },
  ];
  
  let allPassed = true;
  
  for (const { owner, repo } of testCases) {
    const passed = await testAnalysisEndpoint(owner, repo);
    if (!passed) allPassed = false;
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n==========================================');
  if (allPassed) {
    console.log('✅ All tests passed! The fix is working in production.');
  } else {
    console.log('❌ Some tests failed. Please check the output above.');
  }
}

// Run the tests
runTests().catch(console.error);
