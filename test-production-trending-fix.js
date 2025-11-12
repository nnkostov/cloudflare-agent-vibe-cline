// Test script to verify the production trending endpoint is working with multi-topic search
// Run with: node test-production-trending-fix.js

const PRODUCTION_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function testProductionTrending() {
  console.log('🔍 Testing Production Trending Endpoint\n');
  console.log(`URL: ${PRODUCTION_URL}/api/repos/trending\n`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(`${PRODUCTION_URL}/api/repos/trending`);
    const responseTime = Date.now() - startTime;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Response received successfully!');
    console.log(`Response time: ${responseTime}ms\n`);
    
    console.log('📊 Results Summary:');
    console.log(`Total repositories: ${data.total || data.repositories?.length || 0}`);
    console.log(`Data source: ${data.data_source || 'unknown'}`);
    
    if (data.repositories && data.repositories.length > 0) {
      console.log('\n🏆 Top 10 Trending Repositories:');
      data.repositories.slice(0, 10).forEach((repo, i) => {
        console.log(`\n${i + 1}. ${repo.full_name}`);
        console.log(`   ⭐ ${repo.stars} stars | 🍴 ${repo.forks} forks`);
        console.log(`   📊 Tier: ${repo.tier || 'N/A'} | Trending Score: ${repo.trending_score || 0}`);
        console.log(`   📝 ${repo.trending_reason || 'No reason provided'}`);
        if (repo.topics && repo.topics.length > 0) {
          console.log(`   🏷️  Topics: ${repo.topics.slice(0, 5).join(', ')}`);
        }
        if (repo.description) {
          console.log(`   📄 ${repo.description.substring(0, 80)}${repo.description.length > 80 ? '...' : ''}`);
        }
      });
      
      // Analyze topic distribution
      const topicCounts = {};
      data.repositories.forEach(repo => {
        if (repo.topics && Array.isArray(repo.topics)) {
          repo.topics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
          });
        }
      });
      
      console.log('\n📈 Topic Distribution:');
      const sortedTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      sortedTopics.forEach(([topic, count]) => {
        console.log(`   ${topic}: ${count} repositories`);
      });
      
      // Check for diversity
      const uniqueOwners = new Set(data.repositories.map(r => r.full_name.split('/')[0]));
      console.log(`\n🌐 Repository Diversity:`);
      console.log(`   Unique owners: ${uniqueOwners.size}`);
      console.log(`   Average stars: ${Math.round(data.repositories.reduce((sum, r) => sum + r.stars, 0) / data.repositories.length)}`);
      
    } else {
      console.log('\n⚠️  No repositories found in the response');
      console.log('This might indicate:');
      console.log('1. The database is empty - run a Quick Scan from the Controls page');
      console.log('2. No repositories meet the trending criteria');
      console.log('3. There might be an issue with the query');
    }
    
    console.log('\n✅ Production test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing production endpoint:', error.message);
    console.log('\nTroubleshooting steps:');
    console.log('1. Check if the worker is deployed correctly');
    console.log('2. Verify the URL is correct');
    console.log('3. Check Cloudflare dashboard for errors');
  }
}

// Run the test
testProductionTrending();
