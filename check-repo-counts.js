const { D1Database, D1DatabaseAPI } = require('@miniflare/d1');
const { createSQLiteDB } = require('@miniflare/shared');
const fs = require('fs').promises;
const path = require('path');

async function checkRepoCounts() {
  try {
    // Read the database file
    const dbPath = path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', 'c5b2e5c771c54b959c66e2b89d3b5ae663857b85ff2693c417b4f8e8d0c6f09e.sqlite');
    const dbBuffer = await fs.readFile(dbPath);
    
    // Create a D1 database instance
    const sqliteDb = await createSQLiteDB(dbBuffer);
    const db = new D1Database(new D1DatabaseAPI(sqliteDb));
    
    console.log('=== Repository Counts ===\n');
    
    // Total repositories
    const totalRepos = await db.prepare('SELECT COUNT(*) as count FROM repositories WHERE is_archived = 0 AND is_fork = 0').first();
    console.log(`Total active repositories: ${totalRepos.count}`);
    
    // Repositories by tier
    const tierCounts = await db.prepare(`
      SELECT rt.tier, COUNT(*) as count 
      FROM repositories r
      INNER JOIN repo_tiers rt ON r.id = rt.repo_id
      WHERE r.is_archived = 0 AND r.is_fork = 0
      GROUP BY rt.tier
      ORDER BY rt.tier
    `).all();
    
    console.log('\nRepositories by tier:');
    tierCounts.results.forEach(row => {
      console.log(`  Tier ${row.tier}: ${row.count} repos`);
    });
    
    // Check scan status for each tier
    console.log('\n=== Scan Status by Tier ===\n');
    
    for (let tier = 1; tier <= 3; tier++) {
      const scanType = tier === 1 ? 'deep' : 'basic';
      const hoursThreshold = tier === 1 ? 24 : (tier === 2 ? 48 : 72);
      
      // Recently scanned
      const recentlyScanned = await db.prepare(`
        SELECT COUNT(*) as count
        FROM repositories r
        INNER JOIN repo_tiers rt ON r.id = rt.repo_id
        WHERE rt.tier = ? 
          AND r.is_archived = 0 
          AND r.is_fork = 0
          AND rt.last_${scanType}_scan > datetime('now', '-${hoursThreshold} hours')
      `).bind(tier).first();
      
      // Needing scan
      const needingScan = await db.prepare(`
        SELECT COUNT(*) as count
        FROM repositories r
        INNER JOIN repo_tiers rt ON r.id = rt.repo_id
        WHERE rt.tier = ? 
          AND r.is_archived = 0 
          AND r.is_fork = 0
          AND (rt.last_${scanType}_scan IS NULL OR rt.last_${scanType}_scan <= datetime('now', '-${hoursThreshold} hours'))
      `).bind(tier).first();
      
      console.log(`Tier ${tier} (${scanType} scan, ${hoursThreshold}h threshold):`);
      console.log(`  Recently scanned: ${recentlyScanned.count}`);
      console.log(`  Needing scan: ${needingScan.count}`);
      console.log('');
    }
    
    // Sample some repos from each tier
    console.log('=== Sample Repositories ===\n');
    
    for (let tier = 1; tier <= 3; tier++) {
      const samples = await db.prepare(`
        SELECT r.full_name, r.stars, rt.last_deep_scan, rt.last_basic_scan
        FROM repositories r
        INNER JOIN repo_tiers rt ON r.id = rt.repo_id
        WHERE rt.tier = ? AND r.is_archived = 0 AND r.is_fork = 0
        ORDER BY r.stars DESC
        LIMIT 3
      `).bind(tier).all();
      
      console.log(`Tier ${tier} samples:`);
      samples.results.forEach(repo => {
        console.log(`  ${repo.full_name} (${repo.stars} stars)`);
        console.log(`    Last deep scan: ${repo.last_deep_scan || 'Never'}`);
        console.log(`    Last basic scan: ${repo.last_basic_scan || 'Never'}`);
      });
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkRepoCounts();
