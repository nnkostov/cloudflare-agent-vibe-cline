// Test the batch analysis fix
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testBatchFix() {
  console.log('🔍 Testing batch analysis fix...\n');
  
  try {
    // First, get a repository that needs analysis
    console.log('1. Getting repositories for batch analysis...');
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
    console.log('Batch response:', JSON.stringify(batchData, null, 2));
    
    if (batchData.repositories && batchData.repositories.length > 0) {
      const repo = batchData.repositories[0];
      console.log(`\n2. Testing analysis for: ${repo.full_name}`);
      
      // Test with the correct parameters
      console.log('\n3. Testing with correct parameters (repoId, repoOwner, repoName)...');
      const correctResponse = await fetch(`${API_URL}/analyze/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoId: repo.id,
          repoOwner: repo.owner,
          repoName: repo.name,
          force: false
        })
      });
      
      console.log(`   Status: ${correctResponse.status}`);
      const correctResult = await correctResponse.text();
      console.log(`   Response: ${correctResult}`);
      
      if (correctResponse.ok) {
        console.log('\n✅ SUCCESS! The batch analysis should now work correctly.');
        console.log('   The frontend is already sending the correct parameters.');
      } else {
        console.log('\n❌ Still failing. The issue might be in the backend.');
      }
      
      // Also test the old format to confirm it fails
      console.log('\n4. Testing with incorrect parameter (repository) to confirm it fails...');
      const incorrectResponse = await fetch(`${API_URL}/analyze/single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: repo.full_name,
          force: false
        })
      });
      
      console.log(`   Status: ${incorrectResponse.status}`);
      const incorrectResult = await incorrectResponse.text();
      console.log(`   Response: ${incorrectResult}`);
      
      if (!incorrectResponse.ok && incorrectResult.includes('Missing required parameters')) {
        console.log('   ✓ Confirmed: This format correctly fails as expected');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testBatchFix();
