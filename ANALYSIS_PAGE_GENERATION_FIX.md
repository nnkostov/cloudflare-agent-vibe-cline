# Analysis Page Generation Fix

## Problem
When users clicked "Generate Analysis" on a repository without an existing analysis, the page would:
1. Load briefly with blue pulsing boxes (skeleton loading)
2. Go blank/white after a moment
3. Provide no feedback that analysis was being generated
4. Not refresh when analysis was complete
5. Require manual page refresh to see results

## Root Cause
The issue was caused by:
1. API response format mismatch - the backend returns different formats for cached vs new analysis
2. Error handling that would throw and cause the page to go blank
3. No proper error boundaries to catch and handle failures gracefully

## Solution
Implemented robust error handling and response parsing:

### Changes Made

1. **Separated Query and Mutation Logic**:
   - Query only fetches existing analysis (doesn't trigger generation)
   - Mutation handles analysis generation separately
   - Prevents React Query caching issues

2. **Added Polling Mechanism**:
   - Polls every 3 seconds when analysis is being generated
   - Automatically stops polling when analysis is found
   - Updates the UI with the new analysis data

3. **Improved Loading States**:
   - Shows animated loading spinner during generation
   - Displays rotating status messages:
     - "Analyzing repository structure..."
     - "Evaluating code quality and architecture..."
     - "Assessing market potential..."
     - "Calculating investment scores..."
     - "Finalizing analysis..."
   - Shows estimated time (15-30 seconds)

4. **Auto-trigger Generation**:
   - Automatically triggers analysis generation when page loads and no analysis exists
   - No need for users to click a button - happens seamlessly

5. **Better Error Handling**:
   - Catches all errors and returns null instead of throwing
   - Handles multiple response formats from the API
   - Never allows the page to go blank - always shows loading or error state
   - Console logging for debugging

6. **Response Format Handling**:
   - Checks for `result.analysis` directly
   - Checks for `result.message` with `result.analysis`
   - Handles generation start messages
   - Falls back to polling if response format is unexpected

## User Experience
1. User clicks "Generate Analysis" from leaderboard
2. Page loads and automatically starts generating analysis
3. Shows progress with animated spinner and status messages
4. Polls backend for completion
5. Automatically displays analysis when ready
6. No more blank pages or confusion

## Technical Details
- Uses React Query's `refetchInterval` for polling
- TypeScript interfaces for type safety
- Proper cleanup on component unmount
- Mutation pattern for triggering side effects
- Comprehensive error boundaries prevent white screens
