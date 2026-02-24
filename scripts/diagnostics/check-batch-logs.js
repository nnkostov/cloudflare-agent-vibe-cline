// Check recent logs to find the failing repository
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function checkBatchLogs() {
  console.log('🔍 Checking recent batch analysis logs...\n');
  
  try {
    // Check recent logs
    console.log('1. Fetching recent logs...');
    const logsResponse = await fetch(`${API_URL}/logs?limit=100`);
    
    if (!logsResponse.ok) {
      console.log('   ❌ Failed to fetch logs:', logsResponse.status, logsResponse.statusText);
      return;
    }
    
    const logsData = await logsResponse.json();
    console.log(`   Found ${logsData.logs?.length || 0} log entries\n`);
    
    // Filter for batch analysis related errors
    const batchErrors = logsData.logs?.filter(log => {
      const message = log.message?.toLowerCase() || '';
      const level = log.level?.toLowerCase() || '';
      
      return (
        level === 'error' || 
        message.includes('batch') ||
        message.includes('analysis') ||
        message.includes('failed') ||
        message.includes('error') ||
        message.includes('repository')
      );
    }) || [];
    
    console.log(`2. Found ${batchErrors.length} batch-related error logs:\n`);
    
    // Group errors by repository
    const repoErrors = {};
    
    batchErrors.forEach(log => {
      // Try to extract repository name from the message
      const repoMatch = log.message?.match(/(?:repo(?:sitory)?|analyzing|analysis of)\s*[:\s]*([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i);
      const fullNameMatch = log.message?.match(/full_name[:\s]*["']?([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)["']?/i);
      const errorMatch = log.message?.match(/error.*?([a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)/i);
      
      const repoName = repoMatch?.[1] || fullNameMatch?.[1] || errorMatch?.[1] || 'unknown';
      
      if (!repoErrors[repoName]) {
        repoErrors[repoName] = [];
      }
      
      repoErrors[repoName].push({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message
      });
    });
    
    // Display errors by repository
    console.log('3. Errors grouped by repository:\n');
    
    Object.entries(repoErrors).forEach(([repo, errors]) => {
      console.log(`   📦 ${repo}:`);
      errors.slice(0, 3).forEach(error => {
        console.log(`      ${error.timestamp} [${error.level}]`);
        console.log(`      ${error.message.substring(0, 150)}${error.message.length > 150 ? '...' : ''}`);
      });
      if (errors.length > 3) {
        console.log(`      ... and ${errors.length - 3} more errors`);
      }
      console.log('');
    });
    
    // Look for specific batch analysis failures
    console.log('4. Looking for batch analysis specific failures...\n');
    
    const batchFailures = logsData.logs?.filter(log => {
      const message = log.message?.toLowerCase() || '';
      return (
        message.includes('batch analysis failed') ||
        message.includes('failed to analyze') ||
        message.includes('analysis error') ||
        message.includes('rate limit') ||
        message.includes('github api error') ||
        message.includes('claude api error')
      );
    }) || [];
    
    if (batchFailures.length > 0) {
      console.log(`   Found ${batchFailures.length} batch analysis failures:\n`);
      
      batchFailures.slice(0, 10).forEach(log => {
        console.log(`   ${log.timestamp} [${log.level}]`);
        console.log(`   ${log.message}`);
        console.log('');
      });
    } else {
      console.log('   No specific batch analysis failures found in recent logs');
    }
    
    // Check for stuck batch processes
    console.log('\n5. Checking for stuck batch processes...');
    
    const batchStartLogs = logsData.logs?.filter(log => 
      log.message?.includes('Starting batch analysis') ||
      log.message?.includes('Batch analysis started')
    ) || [];
    
    const batchEndLogs = logsData.logs?.filter(log => 
      log.message?.includes('Batch analysis completed') ||
      log.message?.includes('Batch analysis finished')
    ) || [];
    
    console.log(`   Batch starts: ${batchStartLogs.length}`);
    console.log(`   Batch completions: ${batchEndLogs.length}`);
    
    if (batchStartLogs.length > batchEndLogs.length) {
      console.log(`   ⚠️  ${batchStartLogs.length - batchEndLogs.length} batch processes may be stuck`);
    }
    
  } catch (error) {
    console.error('❌ Error checking logs:', error);
  }
}

// Run the check
checkBatchLogs();
