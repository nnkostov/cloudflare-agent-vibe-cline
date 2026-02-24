// Test script to verify the analysis data transformation fix in production
const PRODUCTION_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function testAnalysisEndpoint() {
  console.log('🔍 Testing analysis endpoint in production...\n');
  
  const testRepo = 'XingangPan/DragGAN';
  const url = `${PRODUCTION_URL}/api/analyze/${testRepo}`;
  
  try {
    console.log(`📡 Fetching: ${url}`);
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`\n✅ Response Status: ${response.status}`);
    console.log('\n📊 Analysis Data Structure:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if the transformation worked
    if (data.analysis) {
      console.log('\n🔍 Checking field transformation:');
      console.log(`- investment_score: ${data.analysis.investment_score} (should be a number)`);
      console.log(`- innovation_score: ${data.analysis.innovation_score} (should be a number)`);
      console.log(`- team_score: ${data.analysis.team_score} (should be a number)`);
      console.log(`- market_score: ${data.analysis.market_score} (should be a number)`);
      console.log(`- analyzed_at: ${data.analysis.analyzed_at} (should be a valid timestamp)`);
      
      // Verify the fields are properly transformed
      const hasScores = 
        typeof data.analysis.investment_score === 'number' &&
        typeof data.analysis.innovation_score === 'number' &&
        typeof data.analysis.team_score === 'number' &&
        typeof data.analysis.market_score === 'number';
      
      const hasTimestamp = data.analysis.analyzed_at && !isNaN(new Date(data.analysis.analyzed_at).getTime());
      
      if (hasScores && hasTimestamp) {
        console.log('\n✅ SUCCESS: All fields are properly transformed!');
        console.log('- Scores are accessible as flat fields');
        console.log('- Timestamp is properly mapped to analyzed_at');
        console.log(`- Analyzed at: ${new Date(data.analysis.analyzed_at).toLocaleString()}`);
      } else {
        console.log('\n❌ ERROR: Some fields are not properly transformed');
        if (!hasScores) console.log('- Scores are not properly flattened');
        if (!hasTimestamp) console.log('- Timestamp is not properly mapped');
      }
    } else {
      console.log('\n⚠️  No analysis data found in response');
    }
    
  } catch (error) {
    console.error('\n❌ Error testing endpoint:', error);
  }
}

// Run the test
testAnalysisEndpoint();
