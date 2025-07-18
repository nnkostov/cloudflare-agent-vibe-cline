// Script to fix tier assignments for all repositories
// This ensures Tier 3 has repositories (catch-all tier)

const { D1Database } = require('@cloudflare/workers-types');

async function fixTierAssignments() {
  console.log('Starting tier assignment fix...\n');

  try {
    // First, check current tier distribution
    console.log('Current tier distribution:');
    const tierCounts = await db.prepare(`
      SELECT tier, COUNT(*) as count 
      FROM repo_tiers 
      GROUP BY tier 
      ORDER BY tier
    `).all();
    
    tierCounts.results.forEach(row => {
      console.log(`Tier ${row.tier}: ${row.count} repositories`);
    });

    // Get all repositories with their metrics
    console.log('\nFetching all repositories...');
    const repos = await db.prepare(`
      SELECT r.id, r.stars, rt.growth_velocity, rt.engagement_score
      FROM repositories r
      LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
      WHERE r.is_archived = 0 AND r.is_fork = 0
    `).all();

    console.log(`Found ${repos.results.length} repositories to process\n`);

    // Re-tier all repositories
    let tier1Count = 0;
    let tier2Count = 0;
    let tier3Count = 0;

    for (const repo of repos.results) {
      const stars = repo.stars || 0;
      const growthVelocity = repo.growth_velocity || 0;
      const engagementScore = repo.engagement_score || 50; // Default engagement score

      // Determine tier based on new criteria
      let tier;
      if (stars >= 500 && growthVelocity > 20) {
        tier = 1; // Hot prospect - very selective
        tier1Count++;
      } else if (stars >= 100 || growthVelocity > 10) {
        tier = 2; // Rising star - moderately selective
        tier2Count++;
      } else {
        tier = 3; // Long tail - everything else (catch-all)
        tier3Count++;
      }

      // Calculate scan priority
      const scanPriority = Math.round(
        growthVelocity * 0.5 + 
        engagementScore * 0.3 + 
        Math.log10(stars + 1) * 0.2
      );

      // Update or insert tier assignment
      await db.prepare(`
        INSERT OR REPLACE INTO repo_tiers 
        (repo_id, tier, stars, growth_velocity, engagement_score, scan_priority, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(
        repo.id,
        tier,
        stars,
        growthVelocity,
        engagementScore,
        scanPriority
      ).run();
    }

    console.log('\nTier assignment complete!');
    console.log(`Tier 1 (Hot prospects): ${tier1Count} repositories`);
    console.log(`Tier 2 (Rising stars): ${tier2Count} repositories`);
    console.log(`Tier 3 (Long tail): ${tier3Count} repositories`);

    // Verify the new distribution
    console.log('\nVerifying new tier distribution:');
    const newTierCounts = await db.prepare(`
      SELECT tier, COUNT(*) as count 
      FROM repo_tiers 
      GROUP BY tier 
      ORDER BY tier
    `).all();
    
    newTierCounts.results.forEach(row => {
      console.log(`Tier ${row.tier}: ${row.count} repositories`);
    });

    // Show some examples from each tier
    console.log('\nExample repositories from each tier:');
    
    for (let tier = 1; tier <= 3; tier++) {
      console.log(`\nTier ${tier} examples:`);
      const examples = await db.prepare(`
        SELECT r.full_name, r.stars, rt.growth_velocity
        FROM repositories r
        INNER JOIN repo_tiers rt ON r.id = rt.repo_id
        WHERE rt.tier = ?
        ORDER BY r.stars DESC
        LIMIT 3
      `).bind(tier).all();
      
      examples.results.forEach(repo => {
        console.log(`  - ${repo.full_name}: ${repo.stars} stars, growth velocity: ${repo.growth_velocity?.toFixed(2) || 0}`);
      });
    }

  } catch (error) {
    console.error('Error fixing tier assignments:', error);
  }
}

// Note: This script needs to be run in the context of your Cloudflare Worker
// or adapted to connect to your D1 database directly
console.log('This script needs to be run with access to your D1 database.');
console.log('You can run it through a Worker endpoint or adapt it for direct database access.');
