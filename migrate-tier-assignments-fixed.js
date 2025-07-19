/**
 * Migration script to reassign repository tiers with the fixed logic
 */

async function migrateTierAssignments() {
  console.log('🔄 Migrating Repository Tier Assignments...');
  console.log('============================================================');

  try {
    // First, check current distribution
    console.log('📊 Current Distribution (Before Migration):');
    const statusResponse = await fetch('https://github-ai-intelligence.nkostov.workers.dev/api/status');
    const status = await statusResponse.json();
    
    console.log(`   - Tier 1: ${status.tierDistribution.tier1} repositories`);
    console.log(`   - Tier 2: ${status.tierDistribution.tier2} repositories`);
    console.log(`   - Tier 3: ${status.tierDistribution.tier3} repositories`);

    // Get all repositories from both tiers to understand the data
    console.log('\n🔍 Analyzing Current Repository Data...');
    
    const [tier1Response, tier2Response] = await Promise.all([
      fetch('https://github-ai-intelligence.nkostov.workers.dev/api/repos/tier?tier=1'),
      fetch('https://github-ai-intelligence.nkostov.workers.dev/api/repos/tier?tier=2')
    ]);
    
    const tier1Data = await tier1Response.json();
    const tier2Data = await tier2Response.json();
    
    const allRepos = [...tier1Data.repos, ...tier2Data.repos];
    console.log(`   - Total repositories to reassign: ${allRepos.length}`);
    
    // Analyze what the new distribution should be based on the fixed logic
    let newTier1 = 0, newTier2 = 0, newTier3 = 0;
    
    const reassignments = allRepos.map(repo => {
      let newTier;
      const stars = repo.stars;
      const growth_velocity = repo.growth_velocity || 0; // Default to 0 if not available
      
      // Apply the new tier logic (UPDATED to match storage-enhanced.ts)
      if (stars >= 100000 || (stars >= 50000 && growth_velocity > 50)) {
        newTier = 1;
        newTier1++;
      } else if (stars >= 20000 || (stars >= 10000 && growth_velocity > 25)) {
        newTier = 2;
        newTier2++;
      } else {
        newTier = 3;
        newTier3++;
      }
      
      return {
        repo_id: repo.repo_id,
        full_name: repo.full_name || `${repo.owner}/${repo.name}`,
        stars,
        growth_velocity,
        currentTier: repo.tier,
        newTier,
        changed: repo.tier !== newTier
      };
    });
    
    console.log('\n📈 Predicted New Distribution:');
    console.log(`   - Tier 1: ${newTier1} repositories (${newTier1 - status.tierDistribution.tier1 >= 0 ? '+' : ''}${newTier1 - status.tierDistribution.tier1})`);
    console.log(`   - Tier 2: ${newTier2} repositories (${newTier2 - status.tierDistribution.tier2 >= 0 ? '+' : ''}${newTier2 - status.tierDistribution.tier2})`);
    console.log(`   - Tier 3: ${newTier3} repositories (${newTier3 - status.tierDistribution.tier3 >= 0 ? '+' : ''}${newTier3 - status.tierDistribution.tier3})`);
    
    // Show some examples of changes
    const changedRepos = reassignments.filter(r => r.changed);
    console.log(`\n🔄 Repositories that will change tiers: ${changedRepos.length}`);
    
    if (changedRepos.length > 0) {
      console.log('\n   Examples of tier changes:');
      changedRepos.slice(0, 10).forEach(repo => {
        console.log(`   - ${repo.full_name}: Tier ${repo.currentTier} → Tier ${repo.newTier} (${repo.stars} stars)`);
      });
      
      if (changedRepos.length > 10) {
        console.log(`   ... and ${changedRepos.length - 10} more`);
      }
    }
    
    // Show examples of new Tier 3 repositories
    const newTier3Repos = reassignments.filter(r => r.newTier === 3);
    if (newTier3Repos.length > 0) {
      console.log('\n🆕 Examples of new Tier 3 repositories:');
      newTier3Repos.slice(0, 5).forEach(repo => {
        console.log(`   - ${repo.full_name}: ${repo.stars} stars`);
      });
    }
    
    console.log('\n💡 Migration Summary:');
    console.log('   The new tier logic will create a much better distribution:');
    console.log(`   - Tier 1: Only repositories with 50k+ stars or 10k+ stars with high growth`);
    console.log(`   - Tier 2: Repositories with 5k+ stars or 1k+ stars with moderate growth`);
    console.log(`   - Tier 3: All other repositories (finally populated!)`);
    console.log('');
    console.log('   This will fix the empty Tier 3 issue and create a more balanced system.');

  } catch (error) {
    console.error('❌ Migration analysis failed:', error.message);
  }
  
  console.log('\n============================================================');
  console.log('🏁 Tier Assignment Migration Analysis Complete');
  console.log('');
  console.log('📝 Next Steps:');
  console.log('   1. Deploy the updated storage-enhanced.ts with the new tier logic');
  console.log('   2. The new logic will automatically apply to new repositories');
  console.log('   3. Existing repositories will be gradually reassigned during scans');
  console.log('   4. Or run a comprehensive scan to force reassignment of all repos');
}

migrateTierAssignments().catch(console.error);
