require('dotenv').config();
const { D1Database, D1DatabaseAPI } = require('@miniflare/d1');
const { createSQLiteDB } = require('@miniflare/shared');

async function diagnoseBatchFailure() {
  console.log('🔍 Diagnosing Batch Analysis Failure...\n');

  try {
    // Initialize D1 database
    const sqliteDb = await createSQLiteDB(':memory:');
    const db = new D1Database(new D1DatabaseAPI(sqliteDb));
    
    // Import the database
    const { readFileSync } = require('fs');
    const schema = readFileSync('./database/db-export.sql', 'utf8');
    const statements = schema.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.prepare(statement).run();
      }
    }

    console.log('📊 Database loaded successfully\n');

    // 1. Find repositories without any analysis
    console.log('1️⃣ Repositories without any analysis:');
    const noAnalysis = await db.prepare(`
      SELECT r.id, r.full_name, r.stars, r.created_at, rt.tier
      FROM repositories r
      JOIN repo_tiers rt ON r.id = rt.repo_id
      LEFT JOIN analyses a ON r.id = a.repo_id
      WHERE a.id IS NULL
        AND r.is_archived = 0
        AND r.is_fork = 0
      ORDER BY rt.tier ASC, r.stars DESC
      LIMIT 20
    `).all();

    if (noAnalysis.results.length > 0) {
      console.log(`Found ${noAnalysis.results.length} repositories without analysis:`);
      noAnalysis.results.forEach(repo => {
        console.log(`  - ${repo.full_name} (Tier ${repo.tier}, ${repo.stars} stars)`);
      });
    } else {
      console.log('  ✅ All repositories have at least one analysis attempt');
    }

    // 2. Find repositories with old/stale analysis (based on tier thresholds)
    console.log('\n2️⃣ Repositories with stale analysis (by tier):');
    const staleAnalysis = await db.prepare(`
      SELECT r.id, r.full_name, r.stars, rt.tier, 
             MAX(a.created_at) as last_analysis,
             julianday('now') - julianday(MAX(a.created_at)) as days_old
      FROM repositories r
      JOIN repo_tiers rt ON r.id = rt.repo_id
      LEFT JOIN analyses a ON r.id = a.repo_id
      WHERE r.is_archived = 0 AND r.is_fork = 0
      GROUP BY r.id
      HAVING 
        (rt.tier = 1 AND days_old > 7) OR
        (rt.tier = 2 AND days_old > 10) OR
        (rt.tier = 3 AND days_old > 14)
      ORDER BY rt.tier ASC, days_old DESC
      LIMIT 20
    `).all();

    if (staleAnalysis.results.length > 0) {
      console.log(`Found ${staleAnalysis.results.length} repositories with stale analysis:`);
      staleAnalysis.results.forEach(repo => {
        console.log(`  - ${repo.full_name} (Tier ${repo.tier}, ${Math.round(repo.days_old)} days old)`);
      });
    }

    // 3. Check for repositories that might be causing issues
    console.log('\n3️⃣ Potentially problematic repositories:');
    
    // Check for repos with special characters in names
    const specialChars = await db.prepare(`
      SELECT id, full_name, description
      FROM repositories
      WHERE is_archived = 0 AND is_fork = 0
        AND (
          full_name LIKE '%[%' OR 
          full_name LIKE '%]%' OR
          full_name LIKE '%{%' OR
          full_name LIKE '%}%' OR
          full_name LIKE '%<%' OR
          full_name LIKE '%>%' OR
          full_name LIKE '%"%' OR
          full_name LIKE '%''%' OR
          description LIKE '%\n%' OR
          description LIKE '%\r%'
        )
      LIMIT 10
    `).all();

    if (specialChars.results.length > 0) {
      console.log('  ⚠️  Repositories with special characters:');
      specialChars.results.forEach(repo => {
        console.log(`    - ${repo.full_name}`);
        if (repo.description) {
          console.log(`      Description: ${repo.description.substring(0, 50)}...`);
        }
      });
    }

    // 4. Check for repositories with no description or README issues
    console.log('\n4️⃣ Repositories with missing data:');
    const missingData = await db.prepare(`
      SELECT id, full_name, description, language
      FROM repositories
      WHERE is_archived = 0 AND is_fork = 0
        AND (description IS NULL OR description = '' OR language IS NULL)
      ORDER BY stars DESC
      LIMIT 10
    `).all();

    if (missingData.results.length > 0) {
      console.log('  ⚠️  Repositories with missing description or language:');
      missingData.results.forEach(repo => {
        const issues = [];
        if (!repo.description) issues.push('no description');
        if (!repo.language) issues.push('no language');
        console.log(`    - ${repo.full_name} (${issues.join(', ')})`);
      });
    }

    // 5. Find the most likely culprit - repos that appear in batch queries but never get analyzed
    console.log('\n5️⃣ Most likely batch failure candidates:');
    const candidates = await db.prepare(`
      SELECT r.id, r.full_name, r.owner, r.name, r.stars, rt.tier,
             r.description, r.language, r.topics,
             COUNT(DISTINCT DATE(r.created_at)) as discovery_count
      FROM repositories r
      JOIN repo_tiers rt ON r.id = rt.repo_id
      LEFT JOIN analyses a ON r.id = a.repo_id
      WHERE a.id IS NULL
        AND r.is_archived = 0
        AND r.is_fork = 0
        AND rt.tier IN (1, 2)  -- Focus on higher tiers that should be analyzed
      GROUP BY r.id
      ORDER BY rt.tier ASC, r.stars DESC
      LIMIT 5
    `).all();

    if (candidates.results.length > 0) {
      console.log('\n🎯 TOP SUSPECTS (repositories that should have been analyzed but haven\'t):');
      for (const repo of candidates.results) {
        console.log(`\n  Repository: ${repo.full_name}`);
        console.log(`  - ID: ${repo.id}`);
        console.log(`  - Tier: ${repo.tier}`);
        console.log(`  - Stars: ${repo.stars}`);
        console.log(`  - Language: ${repo.language || 'NULL'}`);
        console.log(`  - Description: ${repo.description ? repo.description.substring(0, 100) + '...' : 'NULL'}`);
        console.log(`  - Topics: ${repo.topics || 'none'}`);
      }

      // Return the most likely culprit for further testing
      const suspect = candidates.results[0];
      console.log('\n🔴 PRIME SUSPECT:', suspect.full_name);
      console.log('\nTo test this repository individually, run:');
      console.log(`node test-single-repo-analysis.js "${suspect.owner}" "${suspect.name}"`);
      
      return suspect;
    } else {
      console.log('  ✅ No obvious candidates found');
    }

    // 6. Check for any error patterns in recent analyses
    console.log('\n6️⃣ Recent analysis patterns:');
    const recentAnalyses = await db.prepare(`
      SELECT 
        DATE(a.created_at) as analysis_date,
        COUNT(*) as total_analyses,
        COUNT(DISTINCT a.repo_id) as unique_repos
      FROM analyses a
      WHERE a.created_at > datetime('now', '-7 days')
      GROUP BY DATE(a.created_at)
      ORDER BY analysis_date DESC
    `).all();

    console.log('  Recent analysis activity:');
    recentAnalyses.results.forEach(day => {
      console.log(`    ${day.analysis_date}: ${day.total_analyses} analyses for ${day.unique_repos} repos`);
    });

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
  }
}

// Run the diagnosis
diagnoseBatchFailure().catch(console.error);
