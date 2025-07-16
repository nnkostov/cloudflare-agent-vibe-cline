@echo off
REM Production Deployment Script for GitHub AI Intelligence Agent

echo Starting production deployment...

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Error: wrangler CLI not found. Please install it with: npm install -g wrangler
    exit /b 1
)

REM Verify TypeScript compilation
echo Checking TypeScript compilation...
call npm run typecheck
if %ERRORLEVEL% NEQ 0 (
    echo TypeScript compilation failed. Please fix errors before deploying.
    exit /b 1
)

REM Deploy to production
echo Deploying to Cloudflare Workers (production)...
call npx wrangler deploy

REM Check deployment status
if %ERRORLEVEL% EQU 0 (
    echo.
    echo Deployment successful!
    echo.
    echo Next steps:
    echo 1. Verify the deployment:
    echo    curl https://github-ai-intelligence.nkostov.workers.dev/
    echo.
    echo 2. Check API status:
    echo    curl https://github-ai-intelligence.nkostov.workers.dev/api/status
    echo.
    echo 3. Initialize the agent (if not already done):
    echo    curl -X POST https://github-ai-intelligence.nkostov.workers.dev/api/agent/init
    echo.
    echo 4. Monitor logs:
    echo    npx wrangler tail
) else (
    echo Deployment failed. Check the error messages above.
    exit /b 1
)
