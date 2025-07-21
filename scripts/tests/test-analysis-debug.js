/**
 * Debug script to test the analysis pipeline for a specific repository
 * This will help identify where the analysis is failing
 */

const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';
const TEST_REPO = {
  owner: 'x1xhlol',
  name: 'system-prompts-and-models-of-ai-tools'
};

async function testAnalysisPipeline() {
  console.log('🔍 Testing Analysis Pipeline for:', `${TEST_REPO.owner}/${TEST_REPO.name}`);
  console.log('=' .repeat(60));

  // Step 1: Test if repository exists on GitHub
  console.log('\n1. Testing GitHub Repository Access...');
  try {
    const githubResponse = await fetch(`https://api.github.com/repos/${TEST_REPO.owner}/${TEST_REPO.name}`);
    if (githubResponse.ok) {
      const repoData = await githubResponse.json();
      console.log('✅ Repository exists on GitHub');
      console.log(`   - Stars: ${repoData.stargazers_count}`);
      console.log(`   - Language: ${repoData.language}`);
      console.log(`   - Created: ${repoData.created_at}`);
      console.log(`   - Updated: ${repoData.updated_at}`);
    } else {
      console.log('❌ Repository not found on GitHub:', githubResponse.status, githubResponse.statusText);
      return;
    }
  } catch (error) {
    console.log('❌ Error accessing GitHub:', error.message);
    return;
  }

  // Step 2: Test Worker API status
  console.log('\n2. Testing Worker API Status...');
  try {
    const statusResponse = await fetch(`${WORKER_URL}/api/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ Worker API is accessible');
      console.log(`   - Status: ${status.status}`);
      console.log(`   - Environment: ${status.environment}`);
    } else {
      console.log('❌ Worker API not accessible:', statusResponse.status);
      return;
    }
  } catch (error) {
    console.log('❌ Error accessing Worker API:', error.message);
    return;
  }

  // Step 3: Test analysis endpoint (without force)
  console.log('\n3. Testing Analysis Endpoint (existing analysis)...');
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
    console.log(`   - Response Status: ${analysisResponse.status}`);
    console.log(`   - Response Headers:`, Object.fromEntries(analysisResponse.headers.entries()));
    
    if (analysisResponse.ok) {
      try {
        const analysisData = JSON.parse(responseText);
        console.log('✅ Analysis endpoint responded successfully');
        console.log(`   - Message: ${analysisData.message}`);
        if (analysisData.analysis) {
          console.log(`   - Investment Score: ${analysisData.analysis.investment_score || 'N/A'}`);
        }
      } catch (parseError) {
        console.log('⚠️  Response received but not valid JSON:', responseText.substring(0, 200));
      }
    } else {
      console.log('❌ Analysis endpoint failed');
      console.log(`   - Response: ${responseText}`);
    }
  } catch (error) {
    console.log('❌ Error calling analysis endpoint:', error.message);
  }

  // Step 4: Test analysis endpoint (with force)
  console.log('\n4. Testing Analysis Endpoint (force generation)...');
  try {
    const forceAnalysisResponse = await fetch(`${WORKER_URL}/api/analyze`, {
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

    const forceResponseText = await forceAnalysisResponse.text();
    console.log(`   - Response Status: ${forceAnalysisResponse.status}`);
    
    if (forceAnalysisResponse.ok) {
      try {
        const forceAnalysisData = JSON.parse(forceResponseText);
        console.log('✅ Force analysis succeeded');
        console.log(`   - Message: ${forceAnalysisData.message}`);
        if (forceAnalysisData.analysis) {
          console.log(`   - Investment Score: ${forceAnalysisData.analysis.investment_score || 'N/A'}`);
          console.log(`   - Model Used: ${forceAnalysisData.analysis.model_used || 'N/A'}`);
        }
      } catch (parseError) {
        console.log('⚠️  Force analysis response not valid JSON:', forceResponseText.substring(0, 200));
      }
    } else {
      console.log('❌ Force analysis failed');
      console.log(`   - Response: ${forceResponseText}`);
    }
  } catch (error) {
    console.log('❌ Error calling force analysis:', error.message);
  }

  // Step 5: Test direct frontend URL
  console.log('\n5. Testing Frontend Analysis Page...');
  const frontendUrl = `${WORKER_URL}/analysis/${TEST_REPO.owner}/${TEST_REPO.name}`;
  console.log(`   - URL: ${frontendUrl}`);
  console.log('   - You can test this manually in your browser');

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Analysis Pipeline Test Complete');
}

// Run the test
testAnalysisPipeline().catch(console.error);
