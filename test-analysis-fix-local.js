// Test script to verify the analysis data transformation fix locally

const API_BASE = 'http://localhost:8787/api';

async function testAnalysisEndpoint() {
  console.log('Testing analysis endpoint with field transformation...\n');
  
  try {
    // Test the analyze endpoint for a specific repository
    const testRepo = 'XingangPan/DragGAN';
    const [owner, name] = testRepo.split('/');
    
    console.log(`Testing analysis for ${testRepo}...`);
    
    const response = await fetch(`${API_BASE}/analyze/${owner}/${name}`);
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error('Response:', error);
      return;
    }
    
    const data = await response.json();
    
    console.log('\n=== Response Structure ===');
    console.log('Repository:', data.repository?.full_name);
    
    if (data.analysis) {
      console.log('\n=== Analysis Data ===');
      console.log('repo_id:', data.analysis.repo_id);
      console.log('investment_score:', data.analysis.investment_score);
      console.log('innovation_score:', data.analysis.innovation_score);
      console.log('team_score:', data.analysis.team_score);
      console.log('market_score:', data.analysis.market_score);
      console.log('analyzed_at:', data.analysis.analyzed_at);
      console.log('recommendation:', data.analysis.recommendation);
      console.log('model:', data.analysis.model);
      
      // Check if the transformation worked
      console.log('\n=== Transformation Check ===');
      if (data.analysis.investment_score !== undefined && 
          data.analysis.analyzed_at !== undefined) {
        console.log('✅ SUCCESS: Fields are properly flattened!');
        console.log('- Scores are accessible as flat fields (investment_score, etc.)');
        console.log('- Timestamp is mapped to analyzed_at');
      } else {
        console.log('❌ FAILED: Fields are not properly transformed');
        console.log('Full analysis object:', JSON.stringify(data.analysis, null, 2));
      }
    } else {
      console.log('No analysis data available');
    }
    
  } catch (error) {
    console.error('Error testing endpoint:', error);
  }
}

// Run the test
console.log('Starting local test of analysis field transformation...\n');
testAnalysisEndpoint();
