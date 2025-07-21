// Diagnose stuck batch analysis
const BATCH_ID = 'batch_1752958498354';

async function diagnoseBatch() {
  console.log('🔍 Diagnosing stuck batch analysis...');
  
  try {
    // Check batch status - using GET with query parameter as seen in logs
    const response = await fetch(`https://github-ai-intelligence.nkostov.workers.dev/api/analyze/batch/status?batchId=${BATCH_ID}`);
    
    const data = await response.json();
    console.log('\n📊 Batch Status:', JSON.stringify(data, null, 2));
    
    // Calculate actual metrics
    const elapsed = Date.now() - data.progress.startTime;
    const elapsedMinutes = Math.round(elapsed / 60000);
    const processed = data.progress.completed + data.progress.failed;
    const remaining = data.progress.total - processed;
    
    console.log('\n🔢 Calculated Metrics:');
    console.log(`- Elapsed: ${elapsedMinutes} minutes (${Math.round(elapsed/1000)}s)`);
    console.log(`- Processed: ${processed}/${data.progress.total} (${Math.round(processed/data.progress.total*100)}%)`);
    console.log(`- Remaining: ${remaining} repositories`);
    console.log(`- Average time per repo: ${processed > 0 ? Math.round(elapsed/processed/1000) : 'N/A'}s`);
    console.log(`- Current repository: "${data.progress.currentRepository}"`);
    console.log(`- Estimated completion: ${data.progress.estimatedCompletion}`);
    
    // Check if stuck
    if (processed > 0) {
      const avgTimePerRepo = elapsed / processed;
      const estimatedTotal = avgTimePerRepo * data.progress.total;
      const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);
      
      console.log('\n⏱️ Corrected Estimation:');
      console.log(`- Estimated total time: ${Math.round(estimatedTotal/60000)} minutes`);
      console.log(`- Estimated remaining: ${Math.round(estimatedRemaining/60000)} minutes`);
      
      // Check if stuck (no progress in reasonable time)
      if (avgTimePerRepo > 300000) { // 5 minutes per repo
        console.log('\n🚨 DIAGNOSIS: Batch is STUCK!');
        console.log('- Average time per repository exceeds 5 minutes');
        console.log('- Likely causes: Claude API timeout, GitHub rate limiting, or infinite loop');
        console.log('- Recommendation: Restart batch with timeout protection');
      }
    }
    
    // Check worker status
    console.log('\n🔍 Checking worker status...');
    const statusResponse = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/status');
    const statusData = await statusResponse.json();
    console.log('Worker Status:', JSON.stringify(statusData, null, 2));
    
  } catch (error) {
    console.error('❌ Error diagnosing batch:', error);
  }
}

diagnoseBatch();
