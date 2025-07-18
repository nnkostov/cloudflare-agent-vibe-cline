-- Fix tier assignments to ensure Tier 3 has repositories
-- This script re-tiers all repositories based on the new criteria

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
    (CASE 
        WHEN stars >= 10000 THEN 20
        WHEN stars >= 1000 THEN 15
        WHEN stars >= 100 THEN 10
        WHEN stars >= 10 THEN 5
        ELSE 1
    END) * 0.2
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
    ROUND(
        (CASE 
            WHEN r.stars >= 10000 THEN 20
            WHEN r.stars >= 1000 THEN 15
            WHEN r.stars >= 100 THEN 10
            WHEN r.stars >= 10 THEN 5
            ELSE 1
        END) * 0.2 + 50 * 0.3
    ) as scan_priority,
    CURRENT_TIMESTAMP
FROM repositories r
LEFT JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.repo_id IS NULL
  AND r.is_archived = 0 
  AND r.is_fork = 0;

-- Show new tier distribution
SELECT tier, COUNT(*) as count 
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;
