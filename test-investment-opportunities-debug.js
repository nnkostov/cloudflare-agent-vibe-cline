const API_BASE = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testInvestmentOpportunities() {
  console.log('Testing Investment Opportunities in Daily Report...\n');
  
  try {
    const response = await fetch(`${API_BASE}/reports/daily`);
    const data = await response.json();
    
    console.log('=== DAILY REPORT INVESTMENT OPPORTUNITIES ===');
    console.log('Response Status:', response.status);
    console.log('Investment Opportunities Count:', data.investment_opportunities?.length || 0);
    
    if (data.investment_opportunities && data.investment_opportunities.length > 0) {
      console.log('\n--- Investment Opportunities Data ---');
      data.investment_opportunities.forEach((opp, index) => {
        console.log(`\nOpportunity ${index + 1}:`);
        console.log('- Repository:', opp.repository?.full_name || 'Unknown');
        console.log('- Investment Score:', opp.analysis?.investment_score || 'N/A');
        console.log('- Recommendation:', opp.analysis?.recommendation || 'N/A');
        console.log('- Strengths:', opp.analysis?.strengths || []);
        console.log('- Summary:', opp.analysis?.summary || 'No summary');
      });
    } else {
      console.log('\n❌ NO INVESTMENT OPPORTUNITIES FOUND');
      console.log('This explains why the section appears empty in the frontend.');
      
      // Let's check what high growth repos we have
      console.log('\n--- High Growth Repos (for comparison) ---');
      console.log('High Growth Repos Count:', data.high_growth_repos?.length || 0);
      
      if (data.high_growth_repos && data.high_growth_repos.length > 0) {
        console.log('First few high growth repos:');
        data.high_growth_repos.slice(0, 3).forEach((repo, index) => {
          console.log(`${index + 1}. ${repo.name} (${repo.stars} stars)`);
        });
      }
    }
    
    // Check if we have any analysis data at all
    console.log('\n--- Checking Analysis Data Availability ---');
    
    // Test a specific repository analysis
    if (data.high_growth_repos && data.high_growth_repos.length > 0) {
      const firstRepo = data.high_growth_repos[0];
      const repoName = firstRepo.name;
      
      console.log(`Testing analysis for: ${repoName}`);
      
      try {
        const analysisResponse = await fetch(`${API_BASE}/repos/${encodeURIComponent(repoName)}/analysis`);
        if (analysisResponse.ok) {
          const analysisData = await analysisResponse.json();
          console.log('✅ Analysis data exists for this repo');
          console.log('- Investment Score:', analysisData.scores?.investment || 'N/A');
          console.log('- Recommendation:', analysisData.recommendation || 'N/A');
        } else {
          console.log('❌ No analysis data found for this repo');
        }
      } catch (error) {
        console.log('❌ Error fetching analysis:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error testing investment opportunities:', error);
  }
}

testInvestmentOpportunities();
