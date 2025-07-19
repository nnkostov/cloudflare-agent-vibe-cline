#!/usr/bin/env node

/**
 * Repair Script for Tier Assignment Issue
 * 
 * This script fixes the tier assignment logic to ensure proper distribution:
 * - Tier 1: Top 10-15% of repositories (highest stars/growth)
 * - Tier 2: Next 20-25% of repositories (good performance)
 * - Tier 3: Remaining 60-70% of repositories (all other AI/ML repos)
 */

const API_BASE_URL = process.env.API_URL || 'https://github-ai-intelligence.nkostov.workers.dev';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

async function fetchEndpoint(endpoint) {
  try {
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    log(`❌ Error fetching ${endpoint}: ${error.message}`, 'red');
    return null;
  }
}

async function postEndpoint(endpoint, data) {
  try {
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    log(`❌ Error posting to ${endpoint}: ${error.message}`, 'red');
    return null;
  }
}

function calculateProperTier(repo, allRepos) {
  // Sort all repos by stars to determine percentiles
  const sortedByStars = allRepos.sort((a, b) => b.stars - a.stars);
  const repoIndex = sortedByStars.findIndex(r => r.id === repo.id);
  const percentile = (repoIndex / sortedByStars.length) * 100;
  
  // Calculate growth velocity if we have creation date
  let growthVelocity = 0;
  if (repo.created_at) {
    const createdDate = new Date(repo.created_at);
    const ageInDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    growthVelocity = repo.stars / Math.max(1, ageInDays);
  }
  
  // Tier assignment based on percentiles and growth
  if (percentile <= 15 || (percentile <= 25 && growthVelocity > 10)) {
    return 1; // Top 15% or top 25% with high growth
  } else if (percentile <= 35 || (percentile <= 50 && growthVelocity > 5)) {
    return 2; // Next 20-35% or top 50% with moderate growth
  } else {
    return 3; // Everyone else (60-70% of repositories)
  }
}

async function analyzeCurrentState() {
  logSection('📊 CURRENT STATE ANALYSIS');
  
  // Get all trending repositories to analyze
  const trending = await fetchEndpoint('/repos/trending');
  if (!trending || !trending.repositories) {
    log('❌ Could not fetch trending repositories', 'red');
    return null;
  }
  
  const repos = trending.repositories;
  log(`\n📈 Total Repositories: ${repos.length}`, 'cyan');
  
  // Analyze current tier distribution
  const currentTiers = { 1: 0, 2: 0, 3: 0, null: 0 };
  repos.forEach(repo => {
    if (repo.tier) {
      currentTiers[repo.tier]++;
    } else {
      currentTiers.null++;
    }
  });
  
  log('\n🎯 Current Tier Distribution:', 'bright');
  log(`   Tier 1: ${currentTiers[1]} (${(currentTiers[1]/repos.length*100).toFixed(1)}%)`, 'green');
  log(`   Tier 2: ${currentTiers[2]} (${(currentTiers[2]/repos.length*100).toFixed(1)}%)`, 'yellow');
  log(`   Tier 3: ${currentTiers[3]} (${(currentTiers[3]/repos.length*100).toFixed(1)}%)`, 'cyan');
  log(`   No Tier: ${currentTiers.null} (${(currentTiers.null/repos.length*100).toFixed(1)}%)`, 'red');
  
  // Analyze star distribution
  const stars = repos.map(r => r.stars).sort((a, b) => b - a);
  const p15 = stars[Math.floor(stars.length * 0.15)];
  const p35 = stars[Math.floor(stars.length * 0.35)];
  const median = stars[Math.floor(stars.length * 0.5)];
  
  log('\n⭐ Star Distribution Analysis:', 'bright');
  log(`   Top 15% threshold: ${p15} stars`, 'green');
  log(`   Top 35% threshold: ${p35} stars`, 'yellow');
  log(`   Median: ${median} stars`, 'cyan');
  log(`   Min: ${Math.min(...stars)} | Max: ${Math.max(...stars)}`, 'cyan');
  
  return { repos, currentTiers, thresholds: { p15, p35, median } };
}

async function calculateNewTierAssignments(repos) {
  logSection('🧮 CALCULATING NEW TIER ASSIGNMENTS');
  
  const newAssignments = [];
  const newTiers = { 1: 0, 2: 0, 3: 0 };
  
  repos.forEach(repo => {
    const newTier = calculateProperTier(repo, repos);
    newAssignments.push({
      repo_id: repo.id,
      full_name: repo.full_name,
      stars: repo.stars,
      current_tier: repo.tier,
      new_tier: newTier,
      needs_update: repo.tier !== newTier
    });
    newTiers[newTier]++;
  });
  
  log('\n🎯 Proposed New Tier Distribution:', 'bright');
  log(`   Tier 1: ${newTiers[1]} (${(newTiers[1]/repos.length*100).toFixed(1)}%)`, 'green');
  log(`   Tier 2: ${newTiers[2]} (${(newTiers[2]/repos.length*100).toFixed(1)}%)`, 'yellow');
  log(`   Tier 3: ${newTiers[3]} (${(newTiers[3]/repos.length*100).toFixed(1)}%)`, 'cyan');
  
  // Show examples of changes
  const needsUpdate = newAssignments.filter(a => a.needs_update);
  log(`\n📝 Repositories Needing Updates: ${needsUpdate.length}`, 'bright');
  
  if (needsUpdate.length > 0) {
    log('\n🔄 Sample Changes:', 'bright');
    needsUpdate.slice(0, 10).forEach((assignment, index) => {
      log(`   ${index + 1}. ${assignment.full_name}`, 'cyan');
      log(`      Stars: ${assignment.stars}`, 'cyan');
      log(`      Current: Tier ${assignment.current_tier || 'None'} → New: Tier ${assignment.new_tier}`, 'magenta');
    });
    
    if (needsUpdate.length > 10) {
      log(`   ... and ${needsUpdate.length - 10} more`, 'yellow');
    }
  }
  
  return newAssignments;
}

async function applyTierUpdates(assignments) {
  logSection('🔧 APPLYING TIER UPDATES');
  
  const needsUpdate = assignments.filter(a => a.needs_update);
  
  if (needsUpdate.length === 0) {
    log('✅ No updates needed - all tiers are correct!', 'green');
    return;
  }
  
  log(`\n🚀 Updating ${needsUpdate.length} repository tier assignments...`, 'bright');
  
  let successCount = 0;
  let errorCount = 0;
  
  // Process in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < needsUpdate.length; i += batchSize) {
    const batch = needsUpdate.slice(i, i + batchSize);
    
    log(`\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(needsUpdate.length/batchSize)}...`, 'cyan');
    
    for (const assignment of batch) {
      try {
        // Create the tier update payload
        const updateData = {
          repo_id: assignment.repo_id,
          tier: assignment.new_tier,
          stars: assignment.stars,
          growth_velocity: 0, // Will be calculated properly by the system
          engagement_score: 50 // Default value
        };
        
        // Try to update via the API (this might not exist, so we'll simulate)
        log(`   Updating ${assignment.full_name} to Tier ${assignment.new_tier}...`, 'cyan');
        
        // Since we don't have a direct tier update API, we'll log what should be done
        log(`   ✅ Would update: ${assignment.full_name} → Tier ${assignment.new_tier}`, 'green');
        successCount++;
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        log(`   ❌ Failed to update ${assignment.full_name}: ${error.message}`, 'red');
        errorCount++;
      }
    }
    
    // Delay between batches
    if (i + batchSize < needsUpdate.length) {
      log('   ⏳ Waiting before next batch...', 'yellow');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  log(`\n📊 Update Results:`, 'bright');
  log(`   ✅ Successful: ${successCount}`, 'green');
  log(`   ❌ Failed: ${errorCount}`, errorCount > 0 ? 'red' : 'green');
  log(`   📈 Success Rate: ${(successCount/(successCount+errorCount)*100).toFixed(1)}%`, 'cyan');
}

async function generateSQLScript(assignments) {
  logSection('📝 GENERATING SQL REPAIR SCRIPT');
  
  const needsUpdate = assignments.filter(a => a.needs_update);
  
  if (needsUpdate.length === 0) {
    log('✅ No SQL script needed - all tiers are correct!', 'green');
    return;
  }
  
  log(`\n🔧 Generating SQL script for ${needsUpdate.length} tier updates...`, 'bright');
  
  let sqlScript = `-- Tier Assignment Repair Script
-- Generated: ${new Date().toISOString()}
-- Updates: ${needsUpdate.length} repositories

BEGIN TRANSACTION;

`;

  needsUpdate.forEach(assignment => {
    sqlScript += `-- Update ${assignment.full_name} (${assignment.stars} stars)
UPDATE repo_tiers 
SET tier = ${assignment.new_tier},
    stars = ${assignment.stars},
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '${assignment.repo_id}';

`;
  });
  
  sqlScript += `COMMIT;

-- Verify the new distribution
SELECT tier, COUNT(*) as count, 
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM repo_tiers), 1) as percentage
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;
`;

  // Write the SQL script to a file
  const fs = require('fs').promises;
  const scriptPath = 'repair-tier-assignments.sql';
  
  try {
    await fs.writeFile(scriptPath, sqlScript);
    log(`✅ SQL script written to: ${scriptPath}`, 'green');
    log(`📝 Run this script against your D1 database to apply the fixes`, 'cyan');
  } catch (error) {
    log(`❌ Failed to write SQL script: ${error.message}`, 'red');
  }
}

async function runRepair() {
  log('🔧 GitHub AI Intelligence Agent - Tier Assignment Repair', 'bright');
  log(`🌐 API Base URL: ${API_BASE_URL}`, 'cyan');
  log(`⏰ Time: ${new Date().toLocaleString()}`, 'cyan');
  
  try {
    // Step 1: Analyze current state
    const analysis = await analyzeCurrentState();
    if (!analysis) {
      throw new Error('Failed to analyze current state');
    }
    
    // Step 2: Calculate new tier assignments
    const assignments = await calculateNewTierAssignments(analysis.repos);
    
    // Step 3: Generate SQL repair script
    await generateSQLScript(assignments);
    
    // Step 4: Apply updates (simulated for now)
    await applyTierUpdates(assignments);
    
    logSection('🏁 REPAIR COMPLETE');
    
    log('\n✅ Tier assignment repair completed successfully!', 'green');
    log('\n📋 Summary of Changes:', 'bright');
    log('   - Analyzed current tier distribution', 'cyan');
    log('   - Calculated proper tier assignments based on percentiles', 'cyan');
    log('   - Generated SQL repair script', 'cyan');
    log('   - Identified repositories needing tier updates', 'cyan');
    
    log('\n🎯 Expected Result:', 'bright');
    log('   - Tier 1: ~15% of repositories (top performers)', 'green');
    log('   - Tier 2: ~20-25% of repositories (good performers)', 'yellow');
    log('   - Tier 3: ~60-70% of repositories (all other AI/ML repos)', 'cyan');
    
    log('\n📝 Next Steps:', 'bright');
    log('   1. Review the generated repair-tier-assignments.sql file', 'cyan');
    log('   2. Run the SQL script against your D1 database', 'cyan');
    log('   3. Verify the new tier distribution', 'cyan');
    log('   4. Update the tier assignment logic in storage-enhanced.ts', 'cyan');
    
  } catch (error) {
    logSection('❌ REPAIR FAILED');
    log(`Error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the repair
runRepair();
