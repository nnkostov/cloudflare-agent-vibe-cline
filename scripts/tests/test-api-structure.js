const API_URL = 'http://localhost:8787/api';

async function testApiStructure() {
  console.log('Testing API data structure...\n');

  try {
    // Test trending repos endpoint
    console.log('1. Testing /api/repos/trending endpoint...');
    const trendingResponse = await fetch(`${API_URL}/repos/trending`);
    const trendingData = await trendingResponse.json();
    
    console.log('Response status:', trendingResponse.status);
    console.log('Total repositories:', trendingData.total);
    
    if (trendingData.repositories && trendingData.repositories.length > 0) {
      const firstRepo = trendingData.repositories[0];
      console.log('\nFirst repository structure:');
      console.log('- id:', firstRepo.id);
      console.log('- name:', firstRepo.name);
      console.log('- owner:', firstRepo.owner);
      console.log('- full_name:', firstRepo.full_name);
      console.log('- stars:', firstRepo.stars);
      console.log('- forks:', firstRepo.forks);
      console.log('- language:', firstRepo.language);
      console.log('- tier:', firstRepo.tier);
      console.log('- has topics:', Array.isArray(firstRepo.topics));
      console.log('- has latest_analysis:', !!firstRepo.latest_analysis);
      
      if (firstRepo.latest_analysis) {
        console.log('\nAnalysis structure:');
        console.log('- investment_score:', firstRepo.latest_analysis.investment_score);
        console.log('- innovation_score:', firstRepo.latest_analysis.innovation_score);
        console.log('- team_score:', firstRepo.latest_analysis.team_score);
        console.log('- market_score:', firstRepo.latest_analysis.market_score);
        console.log('- recommendation:', firstRepo.latest_analysis.recommendation);
        console.log('- analyzed_at:', firstRepo.latest_analysis.analyzed_at);
        console.log('- model_used:', firstRepo.latest_analysis.model_used);
      }
    }

    // Test tier endpoint
    console.log('\n\n2. Testing /api/repos/tier endpoint...');
    const tierResponse = await fetch(`${API_URL}/repos/tier?tier=1`);
    const tierData = await tierResponse.json();
    
    console.log('Response status:', tierResponse.status);
    console.log('Tier:', tierData.tier);
    console.log('Count:', tierData.count);
    
    if (tierData.repos && tierData.repos.length > 0) {
      const firstTierRepo = tierData.repos[0];
      console.log('\nFirst tier repository:');
      console.log('- name:', firstTierRepo.name);
      console.log('- owner:', firstTierRepo.owner);
      console.log('- full_name:', firstTierRepo.full_name);
      console.log('- tier:', firstTierRepo.tier);
    }

    // Test alerts endpoint
    console.log('\n\n3. Testing /api/alerts endpoint...');
    const alertsResponse = await fetch(`${API_URL}/alerts`);
    const alertsData = await alertsResponse.json();
    
    console.log('Response status:', alertsResponse.status);
    console.log('Alerts count:', alertsData.alerts?.length || 0);

    console.log('\n✅ API structure test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

// Run the test
testApiStructure();
