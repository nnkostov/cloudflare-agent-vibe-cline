# Comprehensive Sweep 12-Hour Schedule Implementation

## Summary

Updated the comprehensive sweep schedule to run every 12 hours instead of every 24 hours. The comprehensive sweep now runs at 2 AM and 2 PM daily, providing more frequent full coverage analysis of the repository database.

## Changes Made

### 1. Updated Cron Schedule (`wrangler.toml`)

```toml
[triggers]
crons = [
  "0 * * * *",      # Every hour: Comprehensive scan + Batch analysis
  "0 2,14 * * *"    # Twice daily at 2 AM and 2 PM: Full comprehensive sweep
]
```

### 2. Updated Schedule Detection (`src/agents/GitHubAgent-fixed-comprehensive.ts`)

```typescript
private detectScheduleType(): 'hourly' | 'daily' {
    const now = new Date();
    const hour = now.getHours();
    
    // Comprehensive sweep at 2 AM and 2 PM (every 12 hours)
    if (hour === 2 || hour === 14) {
        return 'daily';
    }
    
    // All other hours are hourly operations
    return 'hourly';
}
```

### 3. Updated Log Messages

Changed the log message to reflect the new schedule:
```typescript
console.log('Starting comprehensive sweep (runs every 12 hours): Full coverage analysis');
```

## Schedule Overview

### Hourly Operations (All hours except 2 AM and 2 PM)
- **Phase 1**: Comprehensive scan (0-3 minutes)
  - Discovers new repositories
  - Updates metrics for existing repositories
  - Processes repositories by tier
- **Phase 2**: Batch analysis (3-5 minutes)
  - Analyzes up to 25 repositories needing analysis
  - Prioritizes by tier and staleness

### Comprehensive Sweep (2 AM and 2 PM)
- Runs in "force mode" with higher targets
- Processes up to 50 Tier 1 repositories (vs 25 hourly)
- Analyzes up to 100 additional repositories
- Ensures complete coverage of the database

## Benefits

1. **More Frequent Coverage**: Database is fully swept twice daily instead of once
2. **Faster Discovery**: New high-potential repositories are found and analyzed more quickly
3. **Better Time Zone Coverage**: 2 AM and 2 PM provide good coverage across different time zones
4. **Maintained Efficiency**: Still respects API rate limits and processing constraints

## Technical Details

- The change only affects when the comprehensive sweep runs
- All other scheduling logic remains unchanged
- The system continues to run hourly operations at all other times
- Rate limiting and API constraints are still respected

## Deployment

After deploying these changes:
1. The next comprehensive sweep will run at either 2 AM or 2 PM (whichever comes first)
2. The system will automatically adjust to the new 12-hour schedule
3. No manual intervention is required

## Monitoring

To verify the new schedule is working:
- Check logs for "Starting comprehensive sweep (runs every 12 hours)" at 2 AM and 2 PM
- Monitor the system status endpoint to see when the last comprehensive sweep ran
- Verify that repository discovery and analysis rates have increased
