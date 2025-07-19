/**
 * Fix script to rebalance tier assignments for better distribution
 */

async function fixTierDistribution() {
  console.log('🔧 Fixing Tier Assignment Distribution...');
  console.log('============================================================');

  try {
    // First, let's see the current distribution
    const statusResponse = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/status');
    const status = await statusResponse.json();
    
    console.log('📊 Current Distribution:');
    console.log(`   - Tier 1: ${status.tierDistribution.tier1} repositories`);
    console.log(`   - Tier 2: ${status.tierDistribution.tier2} repositories`);
    console.log(`   - Tier 3: ${status.tierDistribution.tier3} repositories`);
    
    // Get some sample repositories to understand the data
    console.log('\n🔍 Analyzing Repository Metrics...');
    
    const tier1Response = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/repos/tier?tier=1');
    const tier1Data = await tier1Response.json();
    
    const tier2Response = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/repos/tier?tier=2');
    const tier2Data = await tier2Response.json();
    
    console.log('\n📈 Sample Repository Analysis:');
    
    // Analyze Tier 1 repos
    if (tier1Data.repos.length > 0) {
      const tier1Sample = tier1Data.repos.slice(0, 5);
      console.log('\n   Tier 1 Sample (Top 5):');
      tier1Sample.forEach(repo => {
        console.log(`   - ${repo.full_name}: ${repo.stars} stars`);
      });
      
      const tier1Stars = tier1Sample.map(r => r.stars);
      console.log(`   - Tier 1 star range: ${Math.min(...tier1Stars)} - ${Math.max(...tier1Stars)}`);
    }
    
    // Analyze Tier 2 repos
    if (tier2Data.repos.length > 0) {
      const tier2Sample = tier2Data.repos.slice(0, 5);
      console.log('\n   Tier 2 Sample (Top 5):');
      tier2Sample.forEach(repo => {
        console.log(`   - ${repo.full_name}: ${repo.stars} stars`);
      });
      
      const tier2Stars = tier2Sample.map(r => r.stars);
      console.log(`   - Tier 2 star range: ${Math.min(...tier2Stars)} - ${Math.max(...tier2Stars)}`);
      
      // Check bottom of Tier 2 to see what should be Tier 3
      const tier2Bottom = tier2Data.repos.slice(-5);
      console.log('\n   Tier 2 Bottom (Last 5):');
      tier2Bottom.forEach(repo => {
        console.log(`   - ${repo.full_name}: ${repo.stars} stars`);
      });
      
      const tier2BottomStars = tier2Bottom.map(r => r.stars);
      console.log(`   - Tier 2 bottom star range: ${Math.min(...tier2BottomStars)} - ${Math.max(...tier2BottomStars)}`);
    }
    
    console.log('\n💡 Proposed Fix:');
    console.log('   The current tier assignment logic is too restrictive for Tier 3.');
    console.log('   Most repositories with 100+ stars are going to Tier 2.');
    console.log('   We need to adjust the criteria to create a better distribution:');
    console.log('   ');
    console.log('   Current Logic:');
    console.log('   - Tier 1: stars >= 500 AND growth_velocity > 20');
    console.log('   - Tier 2: stars >= 100 OR growth_velocity > 10');
    console.log('   - Tier 3: everything else');
    console.log('   ');
    console.log('   Proposed New Logic:');
    console.log('   - Tier 1: stars >= 10000 OR (stars >= 1000 AND growth_velocity > 50)');
    console.log('   - Tier 2: stars >= 1000 OR (stars >= 100 AND growth_velocity > 20)');
    console.log('   - Tier 3: stars < 1000 AND growth_velocity <= 20');
    console.log('   ');
    console.log('   This should create a more balanced distribution:');
    console.log('   - Tier 1: ~20-30 top repositories');
    console.log('   - Tier 2: ~50-70 good repositories');
    console.log('   - Tier 3: ~100+ smaller/emerging repositories');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
  
  console.log('\n============================================================');
  console.log('🏁 Tier Distribution Analysis Complete');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Update the tier assignment logic in storage-enhanced.ts');
  console.log('   2. Run a migration to reassign existing repositories');
  console.log('   3. Test the new distribution');
}

fixTierDistribution().catch(console.error);
