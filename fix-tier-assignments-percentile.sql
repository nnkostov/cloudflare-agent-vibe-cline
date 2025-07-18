-- Fix tier assignments using percentile-based distribution
-- This ensures all three tiers have repositories

-- First, let's see the current star distribution
SELECT 
    MIN(stars) as min_stars,
    MAX(stars) as max_stars,
    AVG(stars) as avg_stars,
    COUNT(*) as total_repos
FROM repo_tiers;

-- Create a temporary ranking based on stars and growth velocity
WITH ranked_repos AS (
    SELECT 
        repo_id,
        stars,
        growth_velocity,
        engagement_score,
        -- Rank by a composite score
        ROW_NUMBER() OVER (ORDER BY (stars * 0.7 + COALESCE(growth_velocity, 0) * 100) DESC) as rank,
        COUNT(*) OVER () as total_count
    FROM repo_tiers
)
UPDATE repo_tiers
SET tier = CASE
    -- Top 15% go to Tier 1
    WHEN repo_id IN (SELECT repo_id FROM ranked_repos WHERE rank <= total_count * 0.15) THEN 1
    -- Next 35% go to Tier 2  
    WHEN repo_id IN (SELECT repo_id FROM ranked_repos WHERE rank <= total_count * 0.50) THEN 2
    -- Bottom 50% go to Tier 3
    ELSE 3
END,
updated_at = CURRENT_TIMESTAMP
WHERE repo_id IN (SELECT repo_id FROM ranked_repos);

-- Show new tier distribution
SELECT tier, COUNT(*) as count 
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;

-- Show examples from each tier with their stats
SELECT 'Tier 1 (Top 15%):' as tier_info;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 1
ORDER BY r.stars DESC
LIMIT 5;

SELECT 'Tier 2 (Next 35%):' as tier_info;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 2
ORDER BY r.stars DESC
LIMIT 5;

SELECT 'Tier 3 (Bottom 50%):' as tier_info;
SELECT r.full_name, r.stars, rt.growth_velocity
FROM repositories r
INNER JOIN repo_tiers rt ON r.id = rt.repo_id
WHERE rt.tier = 3
ORDER BY r.stars DESC
LIMIT 5;
