const API_BASE = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testDailyMetrics() {
  console.log('Testing Daily Metrics in Daily Report...\n');
  
  try {
    const response = await fetch(`${API_BASE}/reports/daily`);
    const data = await response.json();
    
    console.log('=== DAILY REPORT METRICS ANALYSIS ===');
    console.log('Response Status:', response.status);
    
    if (data.metrics) {
      console.log('\n--- Daily Metrics Data ---');
      console.log('Repos Scanned:', data.metrics.repos_scanned || 'N/A');
      console.log('New Analyses:', data.metrics.new_analyses || 'N/A');
      console.log('Alerts Generated:', data.metrics.alerts_generated || 'N/A');
      console.log('High Growth Count:', data.high_growth_repos?.length || 'N/A');
      
      console.log('\n--- Full Metrics Object ---');
      console.log(JSON.stringify(data.metrics, null, 2));
      
      // Check if these numbers seem realistic
      console.log('\n--- Sanity Check ---');
      const reposScanned = data.metrics.repos_scanned || 0;
      const newAnalyses = data.metrics.new_analyses || 0;
      const alertsGenerated = data.metrics.alerts_generated || 0;
      
      if (reposScanned === 0) {
        console.log('🚨 SUSPICIOUS: Repos Scanned is 0 - system should be scanning repositories daily');
      } else if (reposScanned > 10000) {
        console.log('🚨 SUSPICIOUS: Repos Scanned is very high (' + reposScanned + ') - might be all-time total');
      } else {
        console.log('✅ Repos Scanned seems reasonable: ' + reposScanned);
      }
      
      if (newAnalyses === 0) {
        console.log('🚨 SUSPICIOUS: New Analyses is 0 - system should be generating analyses');
      } else if (newAnalyses > 1000) {
        console.log('🚨 SUSPICIOUS: New Analyses is very high (' + newAnalyses + ') - might be all-time total');
      } else {
        console.log('✅ New Analyses seems reasonable: ' + newAnalyses);
      }
      
      if (alertsGenerated > 100) {
        console.log('🚨 SUSPICIOUS: Alerts Generated is very high (' + alertsGenerated + ') - might be all-time total');
      } else {
        console.log('✅ Alerts Generated seems reasonable: ' + alertsGenerated);
      }
      
    } else {
      console.log('❌ NO METRICS DATA FOUND');
      console.log('The metrics field is missing from the API response');
    }
    
    // Let's also check what other data is available
    console.log('\n--- Available Report Fields ---');
    console.log('Report Keys:', Object.keys(data));
    
    // Test some actual system endpoints to compare
    console.log('\n--- Cross-Reference with System Data ---');
    
    try {
      // Check total repository count
      const repoCountResponse = await fetch(`${API_BASE}/repos/count`);
      if (repoCountResponse.ok) {
        const repoCountData = await repoCountResponse.json();
        console.log('Total Repositories in System:', repoCountData.count);
        
        const dailyScanned = data.metrics?.repos_scanned || 0;
        if (dailyScanned > repoCountData.count) {
          console.log('🚨 MAJOR ISSUE: Daily scanned (' + dailyScanned + ') > Total repos (' + repoCountData.count + ')');
        }
      }
    } catch (error) {
      console.log('Could not fetch repo count for comparison');
    }
    
    try {
      // Check analysis stats
      const analysisStatsResponse = await fetch(`${API_BASE}/analysis/stats`);
      if (analysisStatsResponse.ok) {
        const analysisStats = await analysisStatsResponse.json();
        console.log('Total Analyzed Repositories:', analysisStats.analyzedRepositories);
        console.log('Remaining to Analyze:', analysisStats.remainingRepositories);
        
        const dailyAnalyses = data.metrics?.new_analyses || 0;
        if (dailyAnalyses > analysisStats.analyzedRepositories) {
          console.log('🚨 MAJOR ISSUE: Daily analyses (' + dailyAnalyses + ') > Total analyzed (' + analysisStats.analyzedRepositories + ')');
        }
      }
    } catch (error) {
      console.log('Could not fetch analysis stats for comparison');
    }
    
  } catch (error) {
    console.error('Error testing daily metrics:', error);
  }
}

testDailyMetrics();
