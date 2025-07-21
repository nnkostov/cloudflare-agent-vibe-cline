-- Fix tier assignments with adjusted thresholds to ensure all tiers have repositories
-- Since we only fetch repos with 100+ stars, we need to adjust thresholds accordingly

-- Update all tier assignments with adjusted criteria
UPDATE repo_tiers
SET tier = CASE
    -- Tier 1: Hot prospects (very selective - top tier)
    WHEN stars >= 1000 AND growth_velocity > 50 THEN 1
    -- Tier 2: Rising stars (moderately selective - middle tier)  
    WHEN stars >= 500 OR growth_velocity > 20 THEN 2
    -- Tier 3: Long tail (everything else - this ensures Tier 3 gets populated)
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

-- Show new tier distribution
SELECT tier, COUNT(*) as count 
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;

-- Show some examples from each tier
SELECT 'Tier 1 examples:' as info;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 1
ORDER BY r.stars DESC
LIMIT 3;

SELECT 'Tier 2 examples:' as info;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 2
ORDER BY r.stars DESC
LIMIT 3;

SELECT 'Tier 3 examples:' as info;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 3
ORDER BY r.stars DESC
LIMIT 3;
