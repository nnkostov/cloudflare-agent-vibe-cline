# Quick Scan Fix Guide

## Issue
The Quick Scan is returning 0 repositories because the GitHub API token is not configured for local development.

## Root Cause
While the secrets are properly configured in Cloudflare (as shown by `npx wrangler secret list`), they are not available in the local development environment. Cloudflare Workers use a `.dev.vars` file for local development secrets.

## Solution

### 1. Configure Local Development Secrets

I've created a `.dev.vars` file in the project root. You need to:

1. Open `.dev.vars`
2. Replace `your_github_token_here` with your actual GitHub Personal Access Token
3. Replace `your_anthropic_api_key_here` with your actual Anthropic API Key

### 2. Generate a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name (e.g., "cloudflare-agent-local-dev")
4. Select scopes:
   - `public_repo` (for public repositories only)
   - OR `repo` (for both public and private repositories)
5. Click "Generate token"OK
6. Copy the token and paste it in `.dev.vars`

### 3. Restart the Development Server

After updating `.dev.vars`, restart the Cloudflare Workers development server:

```bash
# Stop the current server (Ctrl+C)
# Then restart it
npm run dev
```

### 4. Test the Quick Scan

1. Open http://localhost:3003
2. Navigate to the Controls page
3. Click "Run Quick Scan"
4. You should now see repositories being found

## Verification

To verify the GitHub API is working, you can test it directly:

```bash
# First, set the token in your shell (for testing only)
export GITHUB_TOKEN="your_actual_token_here"

# Then test the API
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/search/repositories?q=topic:ai+stars:>=100&sort=stars&order=desc&per_page=5" \
  | jq '.total_count'
```

You should see a number greater than 0 (likely in the thousands).

## Security Notes

- The `.dev.vars` file is already in `.gitignore` to prevent accidental commits
- Never commit your actual tokens to the repository
- For production, use `npx wrangler secret put GITHUB_TOKEN` to securely store secrets

## Troubleshooting

If you're still getting 0 results after configuring the token:

1. **Check Token Permissions**: Ensure your GitHub token has at least `public_repo` scope
2. **Check Rate Limits**: Run the status endpoint to see if you're rate limited:
   ```bash
   curl http://localhost:8787/api/status | jq '.rateLimits'
   ```
3. **Check Database**: The scan saves to a D1 database. Ensure it's properly initialized:
   ```bash
   npx wrangler d1 execute github-intelligence --local --file=schema.sql
   ```
4. **Check Logs**: Look at the terminal running `npm run dev` for any error messages

## Expected Behavior

When working correctly, a Quick Scan should:
1. Search GitHub for repositories with topics like 'ai', 'llm', 'machine-learning', etc.
2. Filter for repositories with at least 100 stars
3. Save found repositories to the database
4. Return a success message with the count of repositories found (typically 10-30)
