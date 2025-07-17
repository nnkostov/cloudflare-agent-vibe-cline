@echo off
echo Clearing cache and deploying...

echo.
echo Step 1: Building dashboard with cache busting...
cd dashboard
call npm run build

echo.
echo Step 2: Deploying to Cloudflare with cache purge...
cd ..
call npx wrangler deploy

echo.
echo Step 3: Purging Cloudflare cache...
echo Note: You may need to manually purge cache from Cloudflare dashboard

echo.
echo Deployment complete!
echo.
echo To ensure you see the latest version:
echo 1. Clear your browser cache (Ctrl+Shift+Delete)
echo 2. Open the site in an incognito/private window
echo 3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
echo.
pause
