@echo off
echo ========================================
echo Deploying Tail Worker for Observability
echo ========================================
echo.

REM Deploy the tail worker
echo Deploying tail worker...
wrangler deploy --config wrangler.tail.toml

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to deploy tail worker
    exit /b 1
)

echo.
echo ========================================
echo Tail Worker Deployment Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run the tail logs schema migration:
echo    wrangler d1 execute github-intelligence --file=./tail-logs-schema.sql
echo.
echo 2. Deploy the main worker to connect the tail consumer:
echo    npm run deploy
echo.
echo 3. Monitor logs via the new API endpoints:
echo    - /api/logs/recent - Recent log entries
echo    - /api/logs/errors - Error summary
echo    - /api/logs/performance - Performance metrics
echo    - /api/logs/api-usage - API usage statistics
echo    - /api/logs/scan-activity - Scan activity metrics
echo    - /api/logs/critical-alerts - Critical system alerts
echo.
