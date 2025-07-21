# Leaderboard View Analysis Fix

## Issue
The "View Analysis" button on the Leaderboard page was not working for any repositories. When clicked, it would navigate to `/analysis/undefined/undefined` instead of the correct repository analysis page.

## Root Cause
The repository data structure returned from the API contains a `full_name` field (e.g., "facebook/react") but the Leaderboard component was trying to access separate `owner` and `name` fields that don't exist in the repository object.

```typescript
// This was failing because repo.owner and repo.name were undefined
<Link to={`/analysis/${repo.owner}/${repo.name}`}>
```

## Solution
Fixed by extracting the owner and repository name from the `full_name` field:

```typescript
// Extract owner and name from full_name
const [owner, name] = repo.full_name.split('/');

// Use the extracted values in the Link
<Link to={`/analysis/${owner}/${name}`}>
  View Analysis
</Link>
```

## Files Modified
- `dashboard/src/pages/Leaderboard.tsx` - Updated the View Analysis button to properly extract owner and name from full_name

## Testing
To verify the fix:
1. Navigate to the Leaderboard page
2. Click on any "View Analysis" button
3. It should now correctly navigate to `/analysis/{owner}/{repo}` and display the repository analysis

## Additional Notes
- The API returns repository data with `full_name` containing the complete GitHub repository path
- The Analysis page expects separate `owner` and `repo` parameters in the URL
- This fix ensures compatibility between the API response format and the routing expectations
