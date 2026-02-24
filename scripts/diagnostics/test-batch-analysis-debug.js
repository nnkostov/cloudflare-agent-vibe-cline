// Test batch analysis API to diagnose the stuck issue
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testBatchAnalysis() {
  console.log('🔍 Testing Batch Analysis API...\n');
  
  try {
    // Test 1: Check if there are any repositories
    console.log('1. Checking repository counts...');
    const tierResponses = await Promise.all([
      fetch(`${API_URL}/repos/tier?tier=1&limit=10`),
      fetch(`${API_URL}/repos/tier?tier=2&limit=10`),
      fetch(`${API_URL}/repos/tier?tier=3&limit=10`)
    ]);
    
    const tierData = await Promise.all(tierResponses.map(r => r.json()));
    console.log('   Tier 1 repos:', tierData[0].totalCount);
    console.log('   Tier 2 repos:', tierData[1].totalCount);
    console.log('   Tier 3 repos:', tierData[2].totalCount);
    console.log('   Total repos:', tierData[0].totalCount + tierData[1].totalCount + tierData[2].totalCount);
    
    // Test 2: Try batch analysis without force
    console.log('\n2. Testing batch analysis (normal mode)...');
    const normalResponse = await fetch(`${API_URL}/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        target: 'visible', 
        force: false,
        chunkSize: 5,
        startIndex: 0,
        batchId: `test_${Date.now()}`
      })
    });
    
    const normalData = await normalResponse.json();
    console.log('   Response:', JSON.stringify(normalData, null, 2));
    
    // Test 3: Try batch analysis with force
    console.log('\n3. Testing batch analysis (force mode)...');
    const forceResponse = await fetch(`${API_URL}/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        target: 'visible', 
        force: true,
        chunkSize: 5,
        startIndex: 0,
        batchId: `test_force_${Date.now()}`
      })
    });
    
    const forceData = await forceResponse.json();
    console.log('   Response:', JSON.stringify(forceData, null, 2));
    
    // Test 4: Check analysis stats
    console.log('\n4. Checking analysis statistics...');
    const statsResponse = await fetch(`${API_URL}/analysis/stats`);
    const statsData = await statsResponse.json();
    console.log('   Total repositories:', statsData.totalRepositories);
    console.log('   Analyzed repositories:', statsData.analyzedRepositories);
    console.log('   Remaining repositories:', statsData.remainingRepositories);
    console.log('   Tier breakdown:');
    console.log('     Tier 1:', `${statsData.tierBreakdown.tier1.analyzed}/${statsData.tierBreakdown.tier1.total} (${statsData.tierBreakdown.tier1.progress}%)`);
    console.log('     Tier 2:', `${statsData.tierBreakdown.tier2.analyzed}/${statsData.tierBreakdown.tier2.total} (${statsData.tierBreakdown.tier2.progress}%)`);
    console.log('     Tier 3:', `${statsData.tierBreakdown.tier3.analyzed}/${statsData.tierBreakdown.tier3.total} (${statsData.tierBreakdown.tier3.progress}%)`);
    
    // Analysis
    console.log('\n📊 ANALYSIS:');
    if (normalData.needingAnalysis === 0 && normalData.queued === 0) {
      console.log('❌ No repositories are being returned for analysis in normal mode');
      console.log('   This explains why the UI shows "0 / 0 repos"');
      
      if (normalData.reason) {
        console.log('   Reason:', normalData.reason);
      }
      
      if (normalData.suggestion) {
        console.log('   Suggestion:', normalData.suggestion);
      }
    }
    
    if (forceData.needingAnalysis === 0 && forceData.queued === 0) {
      console.log('❌ Even force mode returns no repositories');
      console.log('   This indicates a deeper issue with repository discovery or filtering');
    } else if (forceData.needingAnalysis > 0) {
      console.log('✅ Force mode returns repositories:', forceData.needingAnalysis);
      console.log('   The UI should use force mode when normal mode returns nothing');
    }
    
    // Check if the response has the new chunked format
    if (normalData.processed !== undefined || normalData.total !== undefined) {
      console.log('\n✅ Backend is using new chunked format');
      console.log('   processed:', normalData.processed);
      console.log('   total:', normalData.total);
      console.log('   hasMore:', normalData.hasMore);
    } else {
      console.log('\n⚠️ Backend might be using old format');
    }
    
  } catch (error) {
    console.error('❌ Error testing batch analysis:', error);
  }
}

// Run the test
testBatchAnalysis();
