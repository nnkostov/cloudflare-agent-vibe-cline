# API Nexus Activity Display Fix

## Issue
The API activity displays in both the Neural Activity Command Center (Controls page) and the System Activity sidebar were always showing 0% for all three APIs (GitHub, Claude, Search).

## Root Cause
The component was calculating API usage based solely on rate limit consumption:
```javascript
const githubRateLimitUsage = Math.round(((maxTokens - availableTokens) / maxTokens) * 100)
```

When the system hasn't been used recently, rate limits are at their maximum (e.g., 5000/5000 tokens available), resulting in 0% usage.

## Solution Implemented

### 1. Added Worker Metrics Integration
- Integrated the `/api/worker-metrics` endpoint to get real-time activity data
- This endpoint provides actual system activity metrics including API activity, analysis activity, and database activity

### 2. Enhanced Activity Calculations
- **API Activity**: Now uses worker metrics as the primary source, with rate limit consumption as a fallback
- **Analysis Activity**: Combines worker metrics with analysis progress and Claude usage
- **Queue Activity**: Uses database activity metrics combined with queue size indicators

### 3. Improved Display
- Changed API status display from showing just percentages to showing meaningful states:
  - "Ready" when APIs haven't been used
  - "X% used" when there's actual consumption
- Added "Last Activity" indicator showing whether the system is "Active" or "Monitoring"
- Updated detail rows to show more meaningful information:
  - Coverage percentage instead of just "Base Progress"
  - Number of analyzed/remaining repos
  - Queue size and batch information

## Technical Changes

### 1. NeuralActivityCenter.tsx (Controls Page)
1. Added `workerMetrics` query to fetch real-time activity data
2. Modified calculation logic to use worker metrics as primary data source:
   ```javascript
   const latestMetric = workerMetrics?.metrics?.[workerMetrics.metrics.length - 1];
   const apiActivityFromMetrics = latestMetric?.components?.apiActivity || 0;
   ```
3. Enhanced all three activity calculations to combine multiple data sources
4. Improved status displays to show meaningful states instead of just 0%

### 2. Layout.tsx (System Activity Sidebar)
1. Added the same `workerMetrics` query with a different key to avoid conflicts
2. Applied identical calculation logic to ensure consistency across the UI
3. Enhanced tooltips to show the activity source (real-time metrics vs rate limit data)
4. Updated all three metrics (API, Analysis, Queue) to use worker metrics as primary source

## Result
Both the API Nexus and System Activity sidebar now show:
- Real-time activity levels based on actual system usage
- Meaningful status indicators ("Ready", "Active", "Processing")
- Accurate representation of system activity even when rate limits are full
- Dynamic updates every 10 seconds showing current system state

## Testing
To verify the fix:
1. Open any page in the dashboard
2. Check the System Activity sidebar (⚡ SYSTEM ACTIVITY) - the API metric should show meaningful values
3. Navigate to the Controls page
4. Check the Neural Activity Command Center - the API Nexus panel should show consistent activity levels
5. Trigger a scan or batch analysis
6. Observe both displays update in real-time with increased activity
7. When idle, both displays should show low but non-zero activity levels

The fix ensures that users can see actual system activity in both locations rather than just rate limit consumption, providing consistent and accurate insight into what the system is doing across the entire UI.
