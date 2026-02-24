// Find the failing repository by testing batch analysis
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function findFailingRepo() {
  console.log('🔍 Finding the failing repository in batch analysis...\n');
  
  try {
    // First, get all repositories that need analysis
    console.log('1. Getting repositories that need analysis...');
    
    // Get repositories from each tier
    const tierPromises = [1, 2, 3].map(tier => 
      fetch(`${API_URL}/repos/tier?tier=${tier}&limit=500`).then(r => r.json())
    );
    
    const tierData = await Promise.all(tierPromises);
    const allRepos = [];
    
    tierData.forEach((data, index) => {
      if (data.repositories) {
        data.repositories.forEach(repo => {
          allRepos.push({
            ...repo,
            tier: index + 1
          });
        });
      }
    });
    
    console.log(`   Found ${allRepos.length} total repositories\n`);
    
    // Get analysis stats to see which repos need analysis
    console.log('2. Checking which repositories need analysis...');
    const statsResponse = await fetch(`${API_URL}/analysis/stats`);
    const stats = await statsResponse.json();
    
    console.log(`   Analyzed: ${stats.analyzedRepositories}`);
    console.log(`   Remaining: ${stats.remainingRepositories}\n`);
    
    // Test individual repositories to find the one that fails
    console.log('3. Testing individual repositories for analysis...\n');
    
    const reposToTest = allRepos.slice(0, 20); // Test first 20 repos
    const results = [];
    
    for (const repo of reposToTest) {
      console.log(`   Testing: ${repo.full_name} (Tier ${repo.tier}, ${repo.stars} stars)`);
      
      try {
        // Check if repo has analysis
        const analysisResponse = await fetch(`${API_URL}/analysis/${repo.full_name}`);
        
        if (analysisResponse.ok) {
          const analysis = await analysisResponse.json();
          if (analysis && analysis.analysis) {
            console.log(`     ✅ Has analysis (model: ${analysis.analysis.model || 'unknown'})`);
            results.push({ repo: repo.full_name, status: 'has_analysis' });
            continue;
          }
        }
        
        // Try to analyze the repository
        console.log(`     🔄 Attempting to analyze...`);
        const analyzeResponse = await fetch(`${API_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repository: repo.full_name,
            force: true
          })
        });
        
        if (!analyzeResponse.ok) {
          const errorText = await analyzeResponse.text();
          console.log(`     ❌ Analysis failed: ${analyzeResponse.status} - ${errorText}`);
          results.push({ 
            repo: repo.full_name, 
            status: 'failed',
            error: errorText,
            statusCode: analyzeResponse.status
          });
        } else {
          const result = await analyzeResponse.json();
          console.log(`     ✅ Analysis successful`);
          results.push({ repo: repo.full_name, status: 'success' });
        }
        
      } catch (error) {
        console.log(`     ❌ Error: ${error.message}`);
        results.push({ 
          repo: repo.full_name, 
          status: 'error',
          error: error.message
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Summary
    console.log('\n📊 SUMMARY:\n');
    
    const failed = results.filter(r => r.status === 'failed' || r.status === 'error');
    const success = results.filter(r => r.status === 'success');
    const hasAnalysis = results.filter(r => r.status === 'has_analysis');
    
    console.log(`   Total tested: ${results.length}`);
    console.log(`   Already analyzed: ${hasAnalysis.length}`);
    console.log(`   Successfully analyzed: ${success.length}`);
    console.log(`   Failed: ${failed.length}`);
    
    if (failed.length > 0) {
      console.log('\n❌ FAILING REPOSITORIES:\n');
      failed.forEach(f => {
        console.log(`   ${f.repo}:`);
        console.log(`     Status: ${f.status}`);
        if (f.error) console.log(`     Error: ${f.error}`);
        if (f.statusCode) console.log(`     Status Code: ${f.statusCode}`);
        console.log('');
      });
    }
    
    // Test batch analysis with specific repos
    if (failed.length === 0) {
      console.log('\n4. Testing batch analysis endpoint...');
      
      const batchResponse = await fetch(`${API_URL}/analyze/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'visible',
          force: true,
          chunkSize: 1,
          startIndex: 0
        })
      });
      
      const batchData = await batchResponse.json();
      console.log('\n   Batch response:', JSON.stringify(batchData, null, 2));
      
      if (batchData.currentChunk && batchData.currentChunk.length > 0) {
        console.log('\n   Testing first repo from batch:', batchData.currentChunk[0]);
        
        const testResponse = await fetch(`${API_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repository: batchData.currentChunk[0],
            force: true
          })
        });
        
        if (!testResponse.ok) {
          console.log(`\n   ❌ FOUND THE FAILING REPO: ${batchData.currentChunk[0]}`);
          console.log(`   Status: ${testResponse.status}`);
          console.log(`   Error: ${await testResponse.text()}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the finder
findFailingRepo();
