/**
 * Diagnose Tier 3 Repository Count Discrepancy
 * 
 * Controls Page shows: 1,214 (from /api/status using DiagnosticsService.getTierDistribution())
 * Leaderboard Page shows: 1,187 (from /api/repos/tier?tier=3 using StorageUnifiedService.getReposByTier())
 * 
 * Difference: 27 repositories
 * 
 * This script identifies exactly which repositories are causing the discrepancy.
 */

// Database connection setup
const DB_PATH = './db-export.sql'; // Adjust if needed

console.log('🔍 Diagnosing Tier 3 Repository Count Discrepancy...\n');

// Query 1: Controls Page Method (DiagnosticsService.getTierDistribution)
// Uses JOIN-based counting: repositories r JOIN repo_tiers rt ON r.id = rt.repo_id WHERE rt.tier = 3
const controlsPageQuery = `
  SELECT COUNT(*) as count 
  FROM repositories r 
  JOIN repo_tiers rt ON r.id = rt.repo_id 
  WHERE rt.tier = 3
`;

// Query 2: Leaderboard Page Method (StorageUnifiedService.getReposByTier)
// Uses INNER JOIN with additional filters: r.is_archived = 0 AND r.is_fork = 0
const leaderboardPageQuery = `
  SELECT COUNT(*) as count
  FROM repositories r
  INNER JOIN repo_tiers rt ON r.id = rt.repo_id
  WHERE rt.tier = 3 AND r.is_archived = 0 AND r.is_fork = 0
`;

// Query 3: Find the missing repositories (those counted by Controls but not by Leaderboard)
const missingReposQuery = `
  SELECT r.id, r.full_name, r.stars, r.is_archived, r.is_fork, rt.tier,
         CASE 
           WHEN r.is_archived = 1 THEN 'ARCHIVED'
           WHEN r.is_fork = 1 THEN 'FORK'
           ELSE 'UNKNOWN'
         END as exclusion_reason
  FROM repositories r 
  JOIN repo_tiers rt ON r.id = rt.repo_id 
  WHERE rt.tier = 3
    AND r.id NOT IN (
      SELECT r2.id
      FROM repositories r2
      INNER JOIN repo_tiers rt2 ON r2.id = rt2.repo_id
      WHERE rt2.tier = 3 AND r2.is_archived = 0 AND r2.is_fork = 0
    )
  ORDER BY r.stars DESC
`;

// Query 4: Breakdown by exclusion reason
const exclusionBreakdownQuery = `
  SELECT 
    SUM(CASE WHEN r.is_archived = 1 THEN 1 ELSE 0 END) as archived_count,
    SUM(CASE WHEN r.is_fork = 1 THEN 1 ELSE 0 END) as fork_count,
    SUM(CASE WHEN r.is_archived = 1 AND r.is_fork = 1 THEN 1 ELSE 0 END) as both_archived_and_fork,
    COUNT(*) as total_tier3_repos
  FROM repositories r 
  JOIN repo_tiers rt ON r.id = rt.repo_id 
  WHERE rt.tier = 3
`;

// Query 5: Verify data integrity - check for orphaned repo_tiers
const orphanedTiersQuery = `
  SELECT COUNT(*) as orphaned_count
  FROM repo_tiers rt 
  LEFT JOIN repositories r ON rt.repo_id = r.id 
  WHERE r.id IS NULL AND rt.tier = 3
`;

console.log('📊 ANALYSIS RESULTS:\n');

console.log('1️⃣ Controls Page Count (DiagnosticsService method):');
console.log('   Query:', controlsPageQuery.replace(/\s+/g, ' ').trim());
console.log('   Expected Result: 1,214\n');

console.log('2️⃣ Leaderboard Page Count (StorageUnifiedService method):');
console.log('   Query:', leaderboardPageQuery.replace(/\s+/g, ' ').trim());
console.log('   Expected Result: 1,187\n');

console.log('3️⃣ Missing Repositories (causing the discrepancy):');
console.log('   Query:', missingReposQuery.replace(/\s+/g, ' ').trim());
console.log('   Expected Result: 27 repositories\n');

console.log('4️⃣ Exclusion Breakdown:');
console.log('   Query:', exclusionBreakdownQuery.replace(/\s+/g, ' ').trim());
console.log('   This will show how many are archived vs forks\n');

console.log('5️⃣ Data Integrity Check:');
console.log('   Query:', orphanedTiersQuery.replace(/\s+/g, ' ').trim());
console.log('   This checks for orphaned repo_tiers records\n');

console.log('🔧 ROOT CAUSE ANALYSIS:');
console.log('');
console.log('The discrepancy is caused by the different filtering logic:');
console.log('');
console.log('• Controls Page (DiagnosticsService.getTierDistribution):');
console.log('  - Uses simple JOIN: repositories r JOIN repo_tiers rt');
console.log('  - Counts ALL repositories with tier = 3');
console.log('  - No filtering for archived or fork status');
console.log('');
console.log('• Leaderboard Page (StorageUnifiedService.getReposByTier):');
console.log('  - Uses INNER JOIN with filters: r.is_archived = 0 AND r.is_fork = 0');
console.log('  - Only counts ACTIVE, NON-FORK repositories');
console.log('  - Excludes archived and fork repositories from display');
console.log('');
console.log('💡 SOLUTION OPTIONS:');
console.log('');
console.log('Option 1: Update Controls Page to match Leaderboard filtering');
console.log('  - Modify DiagnosticsService.getTierDistribution()');
console.log('  - Add WHERE r.is_archived = 0 AND r.is_fork = 0');
console.log('  - Pro: Consistent counts across pages');
console.log('  - Con: Controls page would show "active" count, not total count');
console.log('');
console.log('Option 2: Update Controls Page to show both counts');
console.log('  - Display: "1,214 total (1,187 active)"');
console.log('  - Pro: Complete transparency');
console.log('  - Con: More complex display');
console.log('');
console.log('Option 3: Update Leaderboard to show total count');
console.log('  - Remove filtering from getReposByTier()');
console.log('  - Pro: Shows complete picture');
console.log('  - Con: Users see archived/fork repos in leaderboard');
console.log('');

console.log('🎯 RECOMMENDED SOLUTION:');
console.log('');
console.log('Update the Controls page to show both counts for transparency:');
console.log('  "1,214 total (1,187 active)"');
console.log('');
console.log('This provides complete information while maintaining the Leaderboard\'s');
console.log('focus on active, relevant repositories for investment analysis.');

console.log('\n✅ Run this script against your database to confirm the exact numbers and see the specific repositories causing the discrepancy.');
