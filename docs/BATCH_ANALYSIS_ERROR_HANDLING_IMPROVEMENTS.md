# Batch Analysis Error Handling Improvements

## Overview
Enhanced the batch analysis system to provide better error visibility, classification, and recovery options for failed repository analyses.

## Frontend Improvements (BatchProgress.tsx)

### 1. Error Classification System
Added intelligent error type classification:
- **Rate Limit** (429) - Retryable
- **Not Found** (404) - Not retryable
- **No README** - Not retryable
- **Auth Error** (401/403) - Not retryable
- **Timeout** (408) - Retryable
- **Claude API Error** - Retryable
- **Network Error** - Retryable
- **Unknown Error** - Retryable by default

### 2. Enhanced Error Tracking
```typescript
interface FailedRepo {
  id: string;
  name: string;
  error: string;
  errorType: 'rate_limit' | 'not_found' | 'no_readme' | 'auth_error' | 'timeout' | 'claude_error' | 'network' | 'unknown';
  retryable: boolean;
  attempts: number;
}
```

### 3. Exponential Backoff
Implemented exponential backoff for retryable errors:
- Base delay: 1000ms
- Backoff formula: `base * 2^(retry_attempt)`
- Prevents overwhelming APIs during temporary issues

### 4. Failed Repository Details
Added expandable section showing:
- Repository name
- Error type with human-readable labels
- Visual indicators (red X icon)
- Scrollable list for many failures

### 5. Retry Failed Repositories
New "Retry Failed" button that:
- Only retries repositories with retryable errors
- Clears retryable failures from the list
- Maintains non-retryable failures for visibility
- Reuses the parallel processing system

## Backend Improvements Needed

To fully support the frontend error handling, the backend should:

1. **Wrap error-prone operations in try-catch blocks**
2. **Provide specific error messages** (e.g., "No README found" vs generic "Analysis failed")
3. **Return appropriate HTTP status codes**:
   - 404 for missing repositories
   - 429 for rate limits
   - 408 for timeouts
   - 500 for server errors

## User Experience Improvements

### During Processing
- Shows which repos are currently being analyzed
- Real-time success/failure counts
- Average processing speed
- Estimated time remaining

### After Completion
- Summary of successful vs failed analyses
- Expandable list of failed repositories with reasons
- One-click retry for all retryable failures
- Clear indication of permanent failures

## Benefits

1. **Transparency**: Users can see exactly why repositories failed
2. **Efficiency**: No unnecessary retries on permanent failures
3. **Recovery**: Easy retry mechanism for temporary failures
4. **Performance**: Exponential backoff prevents API hammering
5. **Debugging**: Detailed error information helps identify patterns

## Testing the Improvements

1. Navigate to the Controls page
2. Start a batch analysis
3. Watch for any failures (shown in red)
4. After completion, click "Show details" to see failed repos
5. Click "Retry X failed repos" to retry only retryable failures

## Future Enhancements

1. **Persistent Failure Log**: Save failed repos to database for later retry
2. **Error Analytics**: Track common failure patterns
3. **Selective Retry**: Allow retrying individual repositories
4. **Error Notifications**: Alert users to critical failures
5. **Auto-Retry Logic**: Automatically retry certain errors after a delay
