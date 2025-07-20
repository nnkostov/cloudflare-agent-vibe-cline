// Debug script to test the reports API and see what data is being returned

async function testReportsAPI() {
  const baseUrl = 'https://github-ai-intelligence.nkostov.workers.dev';
  
  console.log('Testing Reports API endpoints...\n');
  
  try {
    // Test Enhanced Report
    console.log('=== ENHANCED REPORT ===');
    const enhancedResponse = await fetch(`${baseUrl}/api/reports/enhanced`);
    const enhancedData = await enhancedResponse.json();
    
    console.log('Enhanced Report Response Status:', enhancedResponse.status);
    console.log('Enhanced Report Keys:', Object.keys(enhancedData));
    
    if (enhancedData.high_growth_repos_with_metrics) {
      console.log('High Growth Repos Count:', enhancedData.high_growth_repos_with_metrics.length);
      
      if (enhancedData.high_growth_repos_with_metrics.length > 0) {
        const firstRepo = enhancedData.high_growth_repos_with_metrics[0];
        console.log('First High Growth Repo Structure:');
        console.log('- Keys:', Object.keys(firstRepo));
        console.log('- stars:', firstRepo.stars, '(type:', typeof firstRepo.stars, ')');
        console.log('- forks:', firstRepo.forks, '(type:', typeof firstRepo.forks, ')');
        console.log('- full_name:', firstRepo.full_name);
        console.log('- growth_rate:', firstRepo.growth_rate);
        console.log('- Full object:', JSON.stringify(firstRepo, null, 2));
      }
    } else {
      console.log('No high_growth_repos_with_metrics found');
    }
    
    console.log('\n=== DAILY REPORT ===');
    const dailyResponse = await fetch(`${baseUrl}/api/reports/daily`);
    const dailyData = await dailyResponse.json();
    
    console.log('Daily Report Response Status:', dailyResponse.status);
    console.log('Daily Report Keys:', Object.keys(dailyData));
    
    if (dailyData.high_growth_repos) {
      console.log('High Growth Repos Count:', dailyData.high_growth_repos.length);
      
      if (dailyData.high_growth_repos.length > 0) {
        const firstRepo = dailyData.high_growth_repos[0];
        console.log('First High Growth Repo Structure:');
        console.log('- Keys:', Object.keys(firstRepo));
        console.log('- stars:', firstRepo.stars, '(type:', typeof firstRepo.stars, ')');
        console.log('- forks:', firstRepo.forks, '(type:', typeof firstRepo.forks, ')');
        console.log('- full_name:', firstRepo.full_name);
        console.log('- growth_rate:', firstRepo.growth_rate);
        console.log('- Full object:', JSON.stringify(firstRepo, null, 2));
      }
    } else {
      console.log('No high_growth_repos found');
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

// Run the test
testReportsAPI();
