// Debug the exact batch response to find where the "0" is coming from
const BATCH_ID = 'batch_1752958498354';

async function debugBatchResponse() {
  console.log('🔍 Debugging batch response structure...');
  
  try {
    const response = await fetch(`https://github-ai-intelligence.nkostov.workers.dev/api/analyze/batch/status?batchId=${BATCH_ID}`);
    const data = await response.json();
    
    console.log('\n📊 Raw API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n🔍 Detailed Field Analysis:');
    console.log('- batchId:', typeof data.batchId, '=', JSON.stringify(data.batchId));
    console.log('- status:', typeof data.status, '=', JSON.stringify(data.status));
    
    if (data.progress) {
      console.log('\n📈 Progress Object:');
      Object.entries(data.progress).forEach(([key, value]) => {
        console.log(`- ${key}:`, typeof value, '=', JSON.stringify(value));
      });
      
      console.log('\n🎯 Current Repository Analysis:');
      const currentRepo = data.progress.currentRepository;
      console.log('- Raw value:', JSON.stringify(currentRepo));
      console.log('- Type:', typeof currentRepo);
      console.log('- String conversion:', String(currentRepo));
      console.log('- Is "0"?:', currentRepo === '0');
      console.log('- Is 0?:', currentRepo === 0);
      console.log('- Is numeric string?:', /^\d+$/.test(String(currentRepo)));
      console.log('- Trimmed:', JSON.stringify(String(currentRepo).trim()));
    }
    
  } catch (error) {
    console.error('❌ Error debugging batch response:', error);
  }
}

debugBatchResponse();
