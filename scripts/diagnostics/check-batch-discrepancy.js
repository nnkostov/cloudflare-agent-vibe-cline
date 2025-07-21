const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function checkBatchDiscrepancy() {
  console.log('🔍 Investigating Batch Analysis Discrepancy\n');
  
  try {
    // Check the specific batch we've been tracking
    const batchId = 'batch_1753118774070';
    console.log(`Checking batch: ${batchId}`);
    
    const response = await fetch(`${WORKER_URL}/api/analyze/batch/status?batchId=${batchId}`);
    const batchStatus = await response.json();
    
    console.log('\n📊 API Batch Status:');
    console.log(`- Status: ${batchStatus.status}`);
    console.log(`- Completed: ${batchStatus.progress?.completed || 0}`);
    console.log(`- Failed: ${batchStatus.progress?.failed || 0}`);
    console.log(`- Total: ${batchStatus.progress?.total || 0}`);
    console.log(`- Current: ${batchStatus.progress?.currentRepository || 'N/A'}`);
    
    // Check recent analyses to see if there are any with errors
    console.log('\n🔍 Checking Recent Analyses for Errors...');
    const recentRepos = await fetch(`${WORKER_URL}/api/repos/trending?limit=50`).then(r => r.json());
    
    let errorCount = 0;
    let successCount = 0;
    let recentAnalyses = [];
    
    for (const repo of recentRepos.repositories || []) {
      if (repo.latest_analysis) {
        const analysisTime = new Date(repo.latest_analysis.analyzed_at);
        const batchStartTime = new Date('2025-07-21T17:26:14Z');
        
        // Check if this analysis is from our batch timeframe
        if (analysisTime >= batchStartTime) {
          recentAnalyses.push({
            name: repo.name,
            analyzed_at: repo.latest_analysis.analyzed_at,
            has_error: repo.latest_analysis.error || false,
            model: repo.latest_analysis.model_used,
            recommendation: repo.latest_analysis.recommendation
          });
          
          if (repo.latest_analysis.error) {
            errorCount++;
          } else {
            successCount++;
          }
        }
      }
    }
    
    console.log(`\n📈 Recent Analyses (since batch start):`);
    console.log(`- Successful: ${successCount}`);
    console.log(`- With Errors: ${errorCount}`);
    
    // Show the most recent analyses
    console.log('\n📋 Most Recent Analyses:');
    recentAnalyses.slice(0, 10).forEach(analysis => {
      const status = analysis.has_error ? '❌ ERROR' : '✅ SUCCESS';
      console.log(`${status} ${analysis.name} - ${analysis.analyzed_at}`);
    });
    
    // Check if there's a mismatch
    console.log('\n🔍 Discrepancy Analysis:');
    console.log(`UI shows: 8 completed, 4 failed`);
    console.log(`API shows: ${batchStatus.progress?.completed || 0} completed, ${batchStatus.progress?.failed || 0} failed`);
    console.log(`Recent analyses show: ${successCount} successful, ${errorCount} with errors`);
    
    // Possible explanations
    console.log('\n💡 Possible Explanations:');
    if (successCount < (batchStatus.progress?.completed || 0)) {
      console.log('- Some successful analyses might not be visible in trending repos');
    }
    if (errorCount > (batchStatus.progress?.failed || 0)) {
      console.log('- Error count in batch status might be lagging');
    }
    console.log('- UI might be showing a different batch or cached data');
    console.log('- There might be a delay in syncing between backend and frontend');
    
  } catch (error) {
    console.error('❌ Error checking batch discrepancy:', error);
  }
}

checkBatchDiscrepancy();
