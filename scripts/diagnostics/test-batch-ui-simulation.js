// Simulate the exact batch analysis flow from the UI
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function simulateBatchAnalysis() {
  console.log('🔍 Simulating batch analysis UI flow...\n');
  
  try {
    // Step 1: Start batch analysis (like clicking the button)
    console.log('1. Starting batch analysis (simulating UI button click)...');
    const batchId = `batch_${Date.now()}`;
    
    const batchResponse = await fetch(`${API_URL}/analyze/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target: 'visible',
        force: false, // Normal mode first
        chunkSize: 5,
        startIndex: 0,
        batchId: batchId
      })
    });
    
    const batchData = await batchResponse.json();
    console.log('Initial batch response:', JSON.stringify(batchData, null, 2));
    
    if (!batchData.repositories || batchData.repositories.length === 0) {
      console.log('\n❌ No repositories returned for analysis!');
      console.log('Reason:', batchData.reason);
      console.log('Suggestion:', batchData.suggestion);
      
      // Try with force mode
      console.log('\n2. Retrying with force mode...');
      const forceBatchResponse = await fetch(`${API_URL}/analyze/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: 'visible',
          force: true,
          chunkSize: 5,
          startIndex: 0,
          batchId: `${batchId}_force`
        })
      });
      
      const forceBatchData = await forceBatchResponse.json();
      console.log('Force mode response:', JSON.stringify(forceBatchData, null, 2));
      
      if (!forceBatchData.repositories || forceBatchData.repositories.length === 0) {
        console.log('\n❌ Still no repositories even with force mode!');
        return;
      }
      
      // Use force mode data
      batchData.repositories = forceBatchData.repositories;
    }
    
    // Step 2: Process each repository (like the UI does)
    console.log(`\n3. Processing ${batchData.repositories.length} repositories...`);
    
    let successCount = 0;
    let failureCount = 0;
    const failures = [];
    
    for (const repo of batchData.repositories.slice(0, 3)) { // Test first 3
      console.log(`\n   Analyzing ${repo.full_name}...`);
      
      try {
        const analysisResponse = await fetch(`${API_URL}/analyze/single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repoId: repo.id,
            repoOwner: repo.owner,
            repoName: repo.name,
            force: false
          })
        });
        
        if (analysisResponse.ok) {
          const result = await analysisResponse.json();
          console.log(`   ✅ Success: ${result.cached ? 'Cached' : 'Fresh'} analysis`);
          successCount++;
        } else {
          const errorText = await analysisResponse.text();
          console.log(`   ❌ Failed: ${analysisResponse.status} - ${errorText}`);
          failures.push({
            repo: repo.full_name,
            status: analysisResponse.status,
            error: errorText
          });
          failureCount++;
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failures.push({
          repo: repo.full_name,
          error: error.message
        });
        failureCount++;
      }
      
      // Small delay between repos
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Summary
    console.log('\n📊 BATCH ANALYSIS SUMMARY:');
    console.log(`   Total processed: ${successCount + failureCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${failureCount}`);
    
    if (failures.length > 0) {
      console.log('\n❌ FAILED REPOSITORIES:');
      failures.forEach(f => {
        console.log(`   ${f.repo}:`);
        if (f.status) console.log(`     Status: ${f.status}`);
        console.log(`     Error: ${f.error}`);
      });
    }
    
    // Check if n8n-io/n8n is in the list
    const n8nRepo = batchData.repositories.find(r => r.full_name === 'n8n-io/n8n');
    if (n8nRepo) {
      console.log('\n🎯 Found n8n-io/n8n in batch!');
      console.log('   Testing it specifically...');
      
      const n8nResponse = await fetch(`${API_URL}/analyze/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: n8nRepo.id,
          repoOwner: n8nRepo.owner,
          repoName: n8nRepo.name,
          force: false
        })
      });
      
      if (n8nResponse.ok) {
        console.log('   ✅ n8n-io/n8n analyzed successfully!');
      } else {
        const error = await n8nResponse.text();
        console.log(`   ❌ n8n-io/n8n failed: ${n8nResponse.status} - ${error}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the simulation
simulateBatchAnalysis();
