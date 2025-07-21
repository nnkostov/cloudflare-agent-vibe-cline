// Test script for Activity & Momentum Insights feature
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testActivityInsights() {
  console.log('🧪 Testing Activity & Momentum Insights Feature...\n');
  
  try {
    // Fetch the enhanced report
    console.log('📊 Fetching Enhanced Report...');
    const response = await fetch(`${API_URL}/reports/enhanced`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const report = await response.json();
    console.log('✅ Enhanced Report fetched successfully\n');
    
    // Check if activity insights exist
    if (report.activity_insights) {
      console.log('📊 Activity & Momentum Insights Found!\n');
      
      // 1. Most Active Repositories
      if (report.activity_insights.most_active_repos && report.activity_insights.most_active_repos.length > 0) {
        console.log('🔥 Most Active Repositories:');
        report.activity_insights.most_active_repos.forEach((repo, index) => {
          console.log(`${index + 1}. ${repo.full_name}`);
          console.log(`   Updated: ${repo.hours_since_update}h ago`);
          console.log(`   Contributors: ${repo.contributors}`);
          console.log(`   Fork ratio: ${repo.fork_ratio}`);
          console.log(`   Open issues: ${repo.open_issues}`);
          console.log('');
        });
      }
      
      // 2. Community Health Metrics
      if (report.activity_insights.community_metrics) {
        console.log('👥 Community Health:');
        console.log(`   🌟 Large Teams (50+): ${report.activity_insights.community_metrics.large_teams} repos`);
        console.log(`   👥 Growing Teams (10-50): ${report.activity_insights.community_metrics.growing_teams} repos`);
        console.log(`   🚀 Small Teams (<10): ${report.activity_insights.community_metrics.small_teams} repos`);
        console.log('');
      }
      
      // 3. AI Use Case Distribution
      if (report.activity_insights.use_case_distribution && report.activity_insights.use_case_distribution.length > 0) {
        console.log('🎯 AI Use Cases:');
        report.activity_insights.use_case_distribution.forEach(useCase => {
          const bar = '█'.repeat(Math.round(useCase.percentage / 5));
          console.log(`   ${useCase.category.padEnd(20)} ${bar} ${useCase.percentage}% (${useCase.count} repos)`);
        });
        console.log('');
      }
      
      // 4. Momentum Indicators
      if (report.activity_insights.momentum_indicators) {
        console.log('📈 Momentum Status:');
        console.log(`   🚀 Accelerating: ${report.activity_insights.momentum_indicators.accelerating} repos`);
        console.log(`   📈 Growing: ${report.activity_insights.momentum_indicators.growing} repos`);
        console.log(`   ➡️  Steady: ${report.activity_insights.momentum_indicators.steady} repos`);
        console.log(`   📉 Cooling: ${report.activity_insights.momentum_indicators.cooling} repos`);
        console.log('');
      }
      
      // Verify data integrity
      console.log('🔍 Data Integrity Checks:');
      const totalRepos = report.activity_insights.community_metrics.large_teams + 
                        report.activity_insights.community_metrics.growing_teams + 
                        report.activity_insights.community_metrics.small_teams;
      console.log(`   Total repos in community metrics: ${totalRepos}`);
      
      const totalMomentum = report.activity_insights.momentum_indicators.accelerating +
                           report.activity_insights.momentum_indicators.growing +
                           report.activity_insights.momentum_indicators.steady +
                           report.activity_insights.momentum_indicators.cooling;
      console.log(`   Total repos in momentum indicators: ${totalMomentum}`);
      
      console.log('\n✨ Activity & Momentum Insights feature is working correctly!');
      
    } else {
      console.log('⚠️  No activity insights found in the report');
      console.log('   This might indicate the feature is not properly deployed');
    }
    
    // Display report metadata
    console.log('\n📈 Report Metadata:');
    console.log(`   Version: ${report.report_metadata?.version || 'N/A'}`);
    console.log(`   Generated: ${new Date(report.report_metadata?.generated_at || report.date).toLocaleString()}`);
    
  } catch (error) {
    console.error('❌ Error testing activity insights:', error);
  }
}

// Run the test
testActivityInsights();
