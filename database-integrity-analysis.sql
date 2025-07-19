-- Database Integrity Analysis Script
-- Comprehensive check for orphan data records after tier assignment fixes
-- Generated: 2025-07-19T00:57:54.000Z

-- =============================================================================
-- 1. FOREIGN KEY INTEGRITY CHECKS
-- =============================================================================

-- Check for orphaned repo_tiers (repo_id not in repositories)
SELECT 'ORPHANED REPO_TIERS' as check_type, COUNT(*) as count
FROM repo_tiers rt
LEFT JOIN repositories r ON rt.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned analyses (repo_id not in repositories)
SELECT 'ORPHANED ANALYSES' as check_type, COUNT(*) as count
FROM analyses a
LEFT JOIN repositories r ON a.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned repo_metrics (repo_id not in repositories)
SELECT 'ORPHANED REPO_METRICS' as check_type, COUNT(*) as count
FROM repo_metrics rm
LEFT JOIN repositories r ON rm.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned commit_metrics (repo_id not in repositories)
SELECT 'ORPHANED COMMIT_METRICS' as check_type, COUNT(*) as count
FROM commit_metrics cm
LEFT JOIN repositories r ON cm.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned release_history (repo_id not in repositories)
SELECT 'ORPHANED RELEASE_HISTORY' as check_type, COUNT(*) as count
FROM release_history rh
LEFT JOIN repositories r ON rh.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned alerts (repo_id not in repositories)
SELECT 'ORPHANED ALERTS' as check_type, COUNT(*) as count
FROM alerts al
LEFT JOIN repositories r ON al.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned contributors (repo_id not in repositories)
SELECT 'ORPHANED CONTRIBUTORS' as check_type, COUNT(*) as count
FROM contributors c
LEFT JOIN repositories r ON c.repo_id = r.id
WHERE r.id IS NULL;

-- =============================================================================
-- 2. DATA COMPLETENESS CHECKS
-- =============================================================================

-- Check for repositories without tier assignments
SELECT 'REPOS WITHOUT TIERS' as check_type, COUNT(*) as count
FROM repositories r
LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.repo_id IS NULL;

-- Check for repositories without any metrics
SELECT 'REPOS WITHOUT METRICS' as check_type, COUNT(*) as count
FROM repositories r
LEFT JOIN repo_metrics rm ON r.id = rm.repo_id
WHERE rm.repo_id IS NULL;

-- =============================================================================
-- 3. DUPLICATE TABLE STRUCTURE ANALYSIS
-- =============================================================================

-- Check if repository_tiers table exists and has data
SELECT 'REPOSITORY_TIERS_EXISTS' as check_type, 
       CASE WHEN COUNT(*) > 0 THEN 'YES' ELSE 'NO' END as result,
       COUNT(*) as count
FROM sqlite_master 
WHERE type='table' AND name='repository_tiers';

-- If repository_tiers exists, check for data discrepancies
-- (This will only run if the table exists)
SELECT 'TIER_TABLE_DISCREPANCIES' as check_type, COUNT(*) as count
FROM repo_tiers rt
LEFT JOIN repository_tiers rts ON rt.repo_id = rts.repo_id
WHERE rts.repo_id IS NULL OR rt.tier != rts.tier;

-- =============================================================================
-- 4. TIER ASSIGNMENT VALIDATION
-- =============================================================================

-- Check for invalid tier values
SELECT 'INVALID_TIER_VALUES' as check_type, COUNT(*) as count
FROM repo_tiers
WHERE tier NOT IN (1, 2, 3);

-- Check for NULL tier values
SELECT 'NULL_TIER_VALUES' as check_type, COUNT(*) as count
FROM repo_tiers
WHERE tier IS NULL;

-- Check for repositories with multiple tier assignments (should be impossible with PK)
SELECT 'DUPLICATE_TIER_ASSIGNMENTS' as check_type, COUNT(*) as count
FROM (
    SELECT repo_id, COUNT(*) as tier_count
    FROM repo_tiers
    GROUP BY repo_id
    HAVING COUNT(*) > 1
);

-- =============================================================================
-- 5. STAR COUNT CONSISTENCY CHECKS
-- =============================================================================

-- Check for star count mismatches between repositories and repo_tiers
SELECT 'STAR_COUNT_MISMATCHES' as check_type, COUNT(*) as count
FROM repositories r
JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE r.stars != rt.stars;

-- Show examples of star count mismatches (limit 10)
SELECT 'STAR_MISMATCH_EXAMPLES' as check_type,
       r.full_name,
       r.stars as repo_stars,
       rt.stars as tier_stars,
       rt.tier
FROM repositories r
JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE r.stars != rt.stars
LIMIT 10;

-- =============================================================================
-- 6. TIER DISTRIBUTION VALIDATION
-- =============================================================================

-- Current tier distribution
SELECT 'TIER_DISTRIBUTION' as check_type,
       tier,
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM repo_tiers), 1) as percentage
FROM repo_tiers
GROUP BY tier
ORDER BY tier;

-- Check tier assignment logic consistency
-- Tier 1 should have repos with 50K+ stars OR 20K+ with high growth
SELECT 'TIER_1_LOGIC_VIOLATIONS' as check_type, COUNT(*) as count
FROM repo_tiers rt
JOIN repositories r ON rt.repo_id = r.id
WHERE rt.tier = 1 AND r.stars < 20000;

-- Tier 2 should have repos with 15K+ stars OR 5K+ with moderate growth
SELECT 'TIER_2_LOGIC_VIOLATIONS' as check_type, COUNT(*) as count
FROM repo_tiers rt
JOIN repositories r ON rt.repo_id = r.id
WHERE rt.tier = 2 AND r.stars < 5000;

-- =============================================================================
-- 7. ENHANCED TABLES ORPHAN CHECKS
-- =============================================================================

-- Check for orphaned star_history
SELECT 'ORPHANED_STAR_HISTORY' as check_type, COUNT(*) as count
FROM star_history sh
LEFT JOIN repositories r ON sh.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned fork_analysis
SELECT 'ORPHANED_FORK_ANALYSIS' as check_type, COUNT(*) as count
FROM fork_analysis fa
LEFT JOIN repositories r ON fa.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned pull_request_metrics
SELECT 'ORPHANED_PR_METRICS' as check_type, COUNT(*) as count
FROM pull_request_metrics prm
LEFT JOIN repositories r ON prm.repo_id = r.id
WHERE r.id IS NULL;

-- Check for orphaned issue_metrics
SELECT 'ORPHANED_ISSUE_METRICS' as check_type, COUNT(*) as count
FROM issue_metrics im
LEFT JOIN repositories r ON im.repo_id = r.id
WHERE r.id IS NULL;

-- =============================================================================
-- 8. SUMMARY STATISTICS
-- =============================================================================

-- Overall database health summary
SELECT 'TOTAL_REPOSITORIES' as metric, COUNT(*) as value FROM repositories
UNION ALL
SELECT 'TOTAL_REPO_TIERS' as metric, COUNT(*) as value FROM repo_tiers
UNION ALL
SELECT 'TOTAL_ANALYSES' as metric, COUNT(*) as value FROM analyses
UNION ALL
SELECT 'TOTAL_REPO_METRICS' as metric, COUNT(*) as value FROM repo_metrics
UNION ALL
SELECT 'TOTAL_ALERTS' as metric, COUNT(*) as value FROM alerts
UNION ALL
SELECT 'TOTAL_CONTRIBUTORS' as metric, COUNT(*) as value FROM contributors
UNION ALL
SELECT 'TOTAL_COMMIT_METRICS' as metric, COUNT(*) as value FROM commit_metrics
UNION ALL
SELECT 'TOTAL_RELEASE_HISTORY' as metric, COUNT(*) as value FROM release_history
UNION ALL
SELECT 'TOTAL_STAR_HISTORY' as metric, COUNT(*) as value FROM star_history
UNION ALL
SELECT 'TOTAL_FORK_ANALYSIS' as metric, COUNT(*) as value FROM fork_analysis;

-- =============================================================================
-- 9. DETAILED ORPHAN EXAMPLES (if any found)
-- =============================================================================

-- Show examples of orphaned repo_tiers (if any)
SELECT 'ORPHANED_REPO_TIERS_EXAMPLES' as check_type,
       rt.repo_id,
       rt.tier,
       rt.stars
FROM repo_tiers rt
LEFT JOIN repositories r ON rt.repo_id = r.id
WHERE r.id IS NULL
LIMIT 10;

-- Show examples of repositories without tiers (if any)
SELECT 'REPOS_WITHOUT_TIERS_EXAMPLES' as check_type,
       r.id,
       r.full_name,
       r.stars
FROM repositories r
LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.repo_id IS NULL
LIMIT 10;
