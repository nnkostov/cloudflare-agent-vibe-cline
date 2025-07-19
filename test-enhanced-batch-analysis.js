/**
 * Test script to verify the enhanced batch analysis system
 */

const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function testEnhancedBatchAnalysis() {
  console.log('🧪 Testing Enhanced Batch Analysis System');
  console.log('=' .repeat(60));

  // Test 1: Check API status
  console.log('\n1. Testing API Status...');
  try {
    const statusResponse = await fetch(`${WORKER_URL}/api/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log('✅ API is accessible');
      console.log(`   - Environment: ${status.environment}`);
      console.log(`   - Rate Limits Available: GitHub(${status.rateLimits?.github?.availableTokens}), Claude(${status.rateLimits?.claude?.availableTokens})`);
    } else {
      console.log('❌ API not accessible:', statusResponse.status);
      return;
    }
  } catch (error) {
    console.log('❌ Error accessing API:', error.message);
    return;
  }

  // Test 2: Trigger enhanced batch analysis
  console.log('\n2. Testing Enhanced Batch Analysis...');
  try {
    const batchResponse = await fetch(`${WORKER_URL}/api/analyze/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: 'visible'
      })
    });

    const responseText = await batchResponse.text();
    console.log(`   - Response Status: ${batchResponse.status}`);
    
    if (batchResponse.ok) {
      try {
        const batchData = JSON.parse(responseText);
        console.log('✅ Enhanced batch analysis started successfully');
        
        // Log enhanced features
        console.log('\n📊 Enhanced Batch Analysis Details:');
        console.log(`   - Batch ID: ${batchData.batchId || 'N/A'}`);
        console.log(`   - Target: ${batchData.target}`);
        console.log(`   - Total Repos Found: ${batchData.totalRepos}`);
        console.log(`   - Repos Needing Analysis: ${batchData.needingAnalysis}`);
        console.log(`   - Queued for Processing: ${batchData.queued}`);
        console.log(`   - Batch Size: ${batchData.batchSize || 'N/A'}`);
        console.log(`   - Delay Between Analyses: ${batchData.delayBetweenAnalyses || 'N/A'}`);
        console.log(`   - Max Retries: ${batchData.maxRetries || 'N/A'}`);
        console.log(`   - Estimated Completion: ${batchData.estimatedCompletionTime || 'N/A'}`);
        
        // Show repository priorities if available
        if (batchData.repositories && Array.isArray(batchData.repositories) && batchData.repositories.length > 0) {
          console.log('\n🎯 Repository Processing Order (by priority):');
          const repos = batchData.repositories.slice(0, 10); // Show first 10
          repos.forEach((repo, index) => {
            if (typeof repo === 'object' && repo.name) {
              console.log(`   ${index + 1}. ${repo.name} (Priority: ${repo.priority || 'N/A'}, Tier: ${repo.tier || 'N/A'})`);
            } else {
              console.log(`   ${index + 1}. ${repo}`);
            }
          });
          
          if (batchData.repositories.length > 10) {
            console.log(`   ... and ${batchData.repositories.length - 10} more repositories`);
          }
        }
        
        // Verify improvements
        console.log('\n🚀 Improvements Verified:');
        const improvements = [];
        
        if (batchData.batchSize && batchData.batchSize > 10) {
          improvements.push(`✅ Increased batch size: ${batchData.batchSize} (was 10)`);
        }
        
        if (batchData.delayBetweenAnalyses === '2s') {
          improvements.push('✅ Reduced delays: 2s (was 5s)');
        }
        
        if (batchData.maxRetries && batchData.maxRetries > 1) {
          improvements.push(`✅ Retry logic: ${batchData.maxRetries} attempts`);
        }
        
        if (batchData.repositories && batchData.repositories.some(r => r.priority)) {
          improvements.push('✅ Priority-based processing');
        }
        
        if (batchData.batchId) {
          improvements.push('✅ Progress tracking with batch ID');
        }
        
        if (improvements.length > 0) {
          improvements.forEach(improvement => console.log(`   ${improvement}`));
        } else {
          console.log('   ⚠️  Some improvements may not be visible in the response');
        }
        
      } catch (parseError) {
        console.log('⚠️  Response received but not valid JSON:', responseText.substring(0, 200));
      }
    } else {
      console.log('❌ Batch analysis failed');
      console.log(`   - Response: ${responseText}`);
    }
  } catch (error) {
    console.log('❌ Error calling batch analysis:', error.message);
  }

  // Test 3: Check trending repos to see if they have analysis
  console.log('\n3. Testing Repository Analysis Coverage...');
  try {
    const trendingResponse = await fetch(`${WORKER_URL}/api/repos/trending`);
    if (trendingResponse.ok) {
      const trendingData = await trendingResponse.json();
      console.log(`✅ Found ${trendingData.repositories?.length || 0} trending repositories`);
      
      if (trendingData.repositories && trendingData.repositories.length > 0) {
        // Check a few repositories for analysis
        const sampleRepos = trendingData.repositories.slice(0, 5);
        console.log('\n📋 Sample Repository Analysis Status:');
        
        for (const repo of sampleRepos) {
          try {
            const analysisResponse = await fetch(`${WORKER_URL}/api/analyze`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                repoOwner: repo.full_name.split('/')[0],
                repoName: repo.full_name.split('/')[1],
                force: false
              })
            });
            
            if (analysisResponse.ok) {
              const analysisData = await analysisResponse.json();
              if (analysisData.analysis) {
                console.log(`   ✅ ${repo.full_name} - Has analysis (Score: ${analysisData.analysis.investment_score || 'N/A'})`);
              } else {
                console.log(`   ⚠️  ${repo.full_name} - Response structure issue`);
              }
            } else {
              console.log(`   ❌ ${repo.full_name} - No analysis available`);
            }
          } catch (error) {
            console.log(`   ❌ ${repo.full_name} - Error checking analysis`);
          }
          
          // Small delay to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  } catch (error) {
    console.log('❌ Error checking trending repos:', error.message);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('🏁 Enhanced Batch Analysis Test Complete');
  console.log('\n💡 Next Steps:');
  console.log('   1. Monitor the batch analysis progress in the browser console');
  console.log('   2. Check the Leaderboard page in a few minutes to see newly analyzed repositories');
  console.log('   3. Visit specific analysis pages to verify they load correctly');
}

// Run the test
testEnhancedBatchAnalysis().catch(console.error);
