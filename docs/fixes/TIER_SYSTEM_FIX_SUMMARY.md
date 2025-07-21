# Tier System Fix Summary

## Date: January 17, 2025

### Problem Identified
- Tier 3 was returning no repositories
- The system only searches for repositories with 100+ stars (due to `minStars` configuration)
- Tier 3 was defined as repos with <50 stars
- This created an impossible situation where Tier 3 would always be empty

### Root Cause
1. **Search Configuration**: The GitHub search service has a default `minStars = 100`
2. **Tier Definition Mismatch**: 
   - Old Tier 1: stars >= 100 AND growth_velocity > 10
   - Old Tier 2: stars >= 50
   - Old Tier 3: stars < 50 (impossible since we only search for 100+ star repos)

### Solution Implemented
Changed Tier 3 to be a catch-all tier for everything that doesn't qualify for Tier 1 or 2:

#### New Tier Definitions
- **Tier 1 (Hot prospects)**: stars >= 500 AND growth_velocity > 20
  - Very selective, only the highest value repositories
  - Deep scan every hour
  
- **Tier 2 (Rising stars)**: stars >= 100 OR growth_velocity > 10
  - Moderately selective, promising repositories
  - Basic scan every 24 hours
  
- **Tier 3 (Long tail)**: Everything else
  - Catch-all tier for all other repositories
  - Minimal scan every week

### Benefits
1. **No Empty Tiers**: Tier 3 will always have repositories since it's a catch-all
2. **Better Distribution**: More logical distribution of repositories across tiers
3. **Growth Path**: Repositories can be promoted: Tier 3 → Tier 2 → Tier 1
4. **Comprehensive Coverage**: All repositories get assigned to a tier

### Files Modified
- `src/services/storage-enhanced.ts`: Updated `updateRepoTier` method with new tier logic
- `retier-repositories.sql`: Created migration script to re-tier existing repositories

### Migration Script
To apply the new tier definitions to existing repositories, run:
```sql
UPDATE repo_tiers
SET tier = CASE
    WHEN stars >= 500 AND growth_velocity > 20 THEN 1
    WHEN stars >= 100 OR growth_velocity > 10 THEN 2
    ELSE 3
END,
updated_at = CURRENT_TIMESTAMP;
```

### Future Considerations
1. **Lower Search Threshold**: Consider lowering `minStars` from 100 to 50 to discover more diverse repositories
2. **Configurable Tiers**: Make tier thresholds configurable via environment variables
3. **Dynamic Tier Adjustment**: Implement automatic tier rebalancing based on repository distribution

### Testing
After deployment, run a comprehensive scan with force mode to ensure all tiers are properly populated and processing repositories.
