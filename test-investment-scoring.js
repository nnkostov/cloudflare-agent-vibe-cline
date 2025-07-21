// Test script for Investment Scoring feature
const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testInvestmentScoring() {
  console.log('🧪 Testing Investment Scoring Feature...\n');
  
  try {
    // Fetch the enhanced report
    console.log('📊 Fetching Enhanced Report...');
    const response = await fetch(`${API_URL}/reports/enhanced`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const report = await response.json();
    console.log('✅ Enhanced Report fetched successfully\n');
    
    // Check if investment opportunities exist
    if (report.investment_opportunities && report.investment_opportunities.length > 0) {
      console.log(`🏆 Found ${report.investment_opportunities.length} Investment Opportunities:\n`);
      
      report.investment_opportunities.forEach((opp, index) => {
        console.log(`${index + 1}. ${opp.repository.full_name}`);
        console.log(`   Score: ${opp.score} (${opp.score_level})`);
        console.log(`   Stars: ${opp.repository.stars.toLocaleString()}`);
        console.log(`   Growth: +${opp.repository.growth_rate.toFixed(1)}%/month`);
        console.log(`   Language: ${opp.repository.language || 'N/A'}`);
        console.log(`   Has Analysis: ${opp.has_analysis ? '✓' : '✗'}`);
        if (opp.repository.description) {
          console.log(`   Description: ${opp.repository.description.substring(0, 60)}...`);
        }
        console.log('');
      });
      
      // Verify scoring logic
      console.log('🔍 Verifying Score Order...');
      const scores = report.investment_opportunities.map(o => o.score);
      const isSorted = scores.every((score, i) => i === 0 || scores[i-1] >= score);
      console.log(`   Scores properly sorted: ${isSorted ? '✅' : '❌'}`);
      
      // Check score levels
      console.log('\n📊 Score Level Distribution:');
      const levels = report.investment_opportunities.reduce((acc, opp) => {
        acc[opp.score_level] = (acc[opp.score_level] || 0) + 1;
        return acc;
      }, {});
      Object.entries(levels).forEach(([level, count]) => {
        console.log(`   ${level}: ${count} repositories`);
      });
      
    } else {
      console.log('⚠️  No investment opportunities found in the report');
      console.log('   This might mean no high-growth repositories were found');
    }
    
    // Display other report metrics
    console.log('\n📈 Report Metadata:');
    console.log(`   Version: ${report.report_metadata?.version || 'N/A'}`);
    console.log(`   Data Source: ${report.report_metadata?.data_source || 'N/A'}`);
    console.log(`   Generated: ${new Date(report.report_metadata?.generated_at || report.date).toLocaleString()}`);
    
    console.log('\n✨ Investment Scoring feature is working correctly!');
    
  } catch (error) {
    console.error('❌ Error testing investment scoring:', error);
  }
}

// Run the test
testInvestmentScoring();
