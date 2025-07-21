/**
 * Test script to check tier distribution in the database
 */

async function checkTierDistribution() {
  console.log('🔍 Testing Tier Distribution in Database...');
  console.log('============================================================');

  try {
    // Test the API endpoint directly
    const response = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/status');
    
    if (!response.ok) {
      throw new Error(`API not accessible: ${response.status}`);
    }
    
    const status = await response.json();
    console.log('✅ API is accessible');
    
    // Check tier distribution from status
    if (status.tierDistribution) {
      console.log('\n📊 Current Tier Distribution:');
      console.log(`   - Tier 1: ${status.tierDistribution.tier1} repositories`);
      console.log(`   - Tier 2: ${status.tierDistribution.tier2} repositories`);
      console.log(`   - Tier 3: ${status.tierDistribution.tier3} repositories`);
      console.log(`   - Total: ${status.tierDistribution.total} repositories`);
    }
    
    // Test each tier endpoint
    console.log('\n🧪 Testing Tier Endpoints:');
    
    for (let tier = 1; tier <= 3; tier++) {
      try {
        const tierResponse = await fetch(`https://github-ai-intelligence.nkostov.workers.dev/api/repos/tier?tier=${tier}`);
        
        if (tierResponse.ok) {
          const tierData = await tierResponse.json();
          console.log(`   ✅ Tier ${tier}: ${tierData.count} repositories found`);
          
          if (tierData.count > 0) {
            console.log(`      Sample repos: ${tierData.repos.slice(0, 3).map(r => r.full_name).join(', ')}`);
          }
        } else {
          console.log(`   ❌ Tier ${tier}: API error ${tierResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Tier ${tier}: ${error.message}`);
      }
    }
    
    // Test trending repos to see what tiers they have
    console.log('\n📈 Checking Trending Repos Tier Assignment:');
    try {
      const trendingResponse = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/repos/trending');
      
      if (trendingResponse.ok) {
        const trending = await trendingResponse.json();
        const tierCounts = { 1: 0, 2: 0, 3: 0, null: 0 };
        
        trending.repositories.forEach(repo => {
          if (repo.tier) {
            tierCounts[repo.tier]++;
          } else {
            tierCounts.null++;
          }
        });
        
        console.log(`   - Trending repos with Tier 1: ${tierCounts[1]}`);
        console.log(`   - Trending repos with Tier 2: ${tierCounts[2]}`);
        console.log(`   - Trending repos with Tier 3: ${tierCounts[3]}`);
        console.log(`   - Trending repos with no tier: ${tierCounts.null}`);
        
        // Show some examples
        const tier3Repos = trending.repositories.filter(r => r.tier === 3);
        if (tier3Repos.length > 0) {
          console.log(`   - Tier 3 examples: ${tier3Repos.slice(0, 3).map(r => r.full_name).join(', ')}`);
        } else {
          console.log('   - No Tier 3 repositories found in trending list');
        }
      }
    } catch (error) {
      console.log(`   ❌ Error checking trending repos: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
  
  console.log('\n============================================================');
  console.log('🏁 Tier Distribution Test Complete');
}

checkTierDistribution().catch(console.error);
