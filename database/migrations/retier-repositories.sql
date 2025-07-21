-- Re-tier all repositories with the new criteria
-- Tier 1: 500+ stars AND growth_velocity > 20
-- Tier 2: 100+ stars OR growth_velocity > 10
-- Tier 3: Everything else (catch-all)

-- First, update all repos to calculate their current tier
UPDATE repo_tiers
SET tier = CASE
    -- Tier 1: Hot prospects (very selective)
    WHEN stars >= 500 AND growth_velocity > 20 THEN 1
    -- Tier 2: Rising stars (moderately selective)
    WHEN stars >= 100 OR growth_velocity > 10 THEN 2
    -- Tier 3: Long tail (everything else)
    ELSE 3
END,
updated_at = CURRENT_TIMESTAMP;

-- Show the distribution after re-tiering
SELECT 
    tier,
    COUNT(*) as repo_count,
    AVG(stars) as avg_stars,
    MIN(stars) as min_stars,
    MAX(stars) as max_stars,
    AVG(growth_velocity) as avg_growth_velocity
FROM repo_tiers
GROUP BY tier
ORDER BY tier;

-- Show some examples from each tier
SELECT 
    rt.tier,
    r.full_name,
    rt.stars,
    rt.growth_velocity,
    rt.engagement_score
FROM repo_tiers rt
JOIN repositories r ON rt.repo_id = r.id
WHERE rt.tier = 1
ORDER BY rt.stars DESC
LIMIT 5;

SELECT 
    rt.tier,
    r.full_name,
    rt.stars,
    rt.growth_velocity,
    rt.engagement_score
FROM repo_tiers rt
JOIN repositories r ON rt.repo_id = r.id
WHERE rt.tier = 2
ORDER BY rt.stars DESC
LIMIT 5;

SELECT 
    rt.tier,
    r.full_name,
    rt.stars,
    rt.growth_velocity,
    rt.engagement_score
FROM repo_tiers rt
JOIN repositories r ON rt.repo_id = r.id
WHERE rt.tier = 3
ORDER BY rt.stars DESC
LIMIT 5;
