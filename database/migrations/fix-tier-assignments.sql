-- Fix tier assignments to ensure Tier 3 has repositories
-- This script re-tiers all repositories based on the new criteria

-- First, show current tier distribution
SELECT 'Current tier distribution:' as message;
SELECT tier, COUNT(*) as count 
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;

-- Update all tier assignments based on new criteria
UPDATE repo_tiers
SET tier = CASE
    -- Tier 1: Hot prospects (very selective)
    WHEN stars >= 500 AND growth_velocity > 20 THEN 1
    -- Tier 2: Rising stars (moderately selective)  
    WHEN stars >= 100 OR growth_velocity > 10 THEN 2
    -- Tier 3: Long tail (catch-all for everything else)
    ELSE 3
END,
scan_priority = ROUND(
    COALESCE(growth_velocity, 0) * 0.5 + 
    COALESCE(engagement_score, 50) * 0.3 + 
    LOG10(stars + 1) * 0.2
),
updated_at = CURRENT_TIMESTAMP;

-- For repositories not in repo_tiers yet, insert them
INSERT OR IGNORE INTO repo_tiers (repo_id, tier, stars, growth_velocity, engagement_score, scan_priority, updated_at)
SELECT 
    r.id,
    CASE
        WHEN r.stars >= 500 THEN 1  -- Assume high growth for high star repos not yet tiered
        WHEN r.stars >= 100 THEN 2
        ELSE 3
    END as tier,
    r.stars,
    0 as growth_velocity,  -- Default growth velocity
    50 as engagement_score, -- Default engagement score
    ROUND(LOG10(r.stars + 1) * 0.2 + 50 * 0.3) as scan_priority,
    CURRENT_TIMESTAMP
FROM repositories r
LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.repo_id IS NULL
  AND r.is_archived = 0 
  AND r.is_fork = 0;

-- Show new tier distribution
SELECT 'New tier distribution:' as message;
SELECT tier, COUNT(*) as count 
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;

-- Show example repositories from each tier
SELECT 'Tier 1 examples (Hot prospects):' as message;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 1
ORDER BY r.stars DESC
LIMIT 5;

SELECT 'Tier 2 examples (Rising stars):' as message;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 2
ORDER BY r.stars DESC
LIMIT 5;

SELECT 'Tier 3 examples (Long tail):' as message;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 3
ORDER BY r.stars DESC
LIMIT 5;
