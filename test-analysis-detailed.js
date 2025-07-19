/**
 * Detailed debug script to see the actual API responses
 */

const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';
const TEST_REPO = {
  owner: 'x1xhlol',
  name: 'system-prompts-and-models-of-ai-tools'
};

async function testDetailedAnalysis() {
  console.log('🔍 Detailed Analysis Test for:', `${TEST_REPO.owner}/${TEST_REPO.name}`);
  console.log('=' .repeat(60));

  // Test analysis endpoint with detailed response logging
  console.log('\n1. Testing Analysis Endpoint (detailed response)...');
  try {
    const analysisResponse = await fetch(`${WORKER_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoOwner: TEST_REPO.owner,
        repoName: TEST_REPO.name,
        force: false
      })
    });

    const responseText = await analysisResponse.text();
    console.log(`Status: ${analysisResponse.status}`);
    console.log(`Response Length: ${responseText.length} characters`);
    console.log('Raw Response:');
    console.log(responseText);
    
    if (responseText) {
      try {
        const parsed = JSON.parse(responseText);
        console.log('\nParsed Response Structure:');
        console.log('Keys:', Object.keys(parsed));
        console.log('Full Object:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Failed to parse as JSON:', e.message);
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test force analysis
  console.log('\n' + '=' .repeat(60));
  console.log('\n2. Testing Force Analysis (detailed response)...');
  try {
    const forceResponse = await fetch(`${WORKER_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoOwner: TEST_REPO.owner,
        repoName: TEST_REPO.name,
        force: true
      })
    });

    const forceResponseText = await forceResponse.text();
    console.log(`Status: ${forceResponse.status}`);
    console.log(`Response Length: ${forceResponseText.length} characters`);
    console.log('Raw Response:');
    console.log(forceResponseText);
    
    if (forceResponseText) {
      try {
        const parsed = JSON.parse(forceResponseText);
        console.log('\nParsed Response Structure:');
        console.log('Keys:', Object.keys(parsed));
        console.log('Full Object:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('Failed to parse as JSON:', e.message);
      }
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
  }

  // Test what the frontend API client would do
  console.log('\n' + '=' .repeat(60));
  console.log('\n3. Testing Frontend API Pattern...');
  try {
    // This mimics what the frontend API client does
    const frontendResponse = await fetch(`${WORKER_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        repoOwner: TEST_REPO.owner,
        repoName: TEST_REPO.name,
        force: false
      })
    });

    const responseText = await frontendResponse.text();
    console.log(`Frontend API Status: ${frontendResponse.status}`);
    
    if (!frontendResponse.ok) {
      console.log('❌ Frontend API call failed');
      console.log('Error Response:', responseText);
    } else {
      try {
        const data = JSON.parse(responseText);
        console.log('✅ Frontend API call succeeded');
        
        // Check the structure the frontend expects
        if (data && data.analysis) {
          console.log('✅ Analysis data found in response');
          console.log('Analysis keys:', Object.keys(data.analysis));
        } else if (data && data.message === 'Using cached analysis') {
          console.log('✅ Cached analysis response');
          console.log('Analysis keys:', data.analysis ? Object.keys(data.analysis) : 'No analysis object');
        } else {
          console.log('⚠️  Unexpected response structure');
          console.log('Response keys:', Object.keys(data));
          console.log('Full response:', JSON.stringify(data, null, 2));
        }
      } catch (parseError) {
        console.log('❌ Failed to parse frontend response as JSON');
        console.log('Raw response:', responseText.substring(0, 500));
      }
    }
  } catch (error) {
    console.log('❌ Frontend API test error:', error.message);
  }
}

// Run the detailed test
testDetailedAnalysis().catch(console.error);
