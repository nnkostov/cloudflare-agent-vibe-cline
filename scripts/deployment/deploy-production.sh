#!/bin/bash

# Production Deployment Script for GitHub AI Intelligence Agent

echo "🚀 Starting production deployment..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: wrangler CLI not found. Please install it with: npm install -g wrangler"
    exit 1
fi

# Verify TypeScript compilation
echo "📦 Checking TypeScript compilation..."
npm run typecheck
if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed. Please fix errors before deploying."
    exit 1
fi

# Deploy to production
echo "🔧 Deploying to Cloudflare Workers (production)..."
npx wrangler deploy

# Check deployment status
if [ $? -eq 0 ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Verify the deployment:"
    echo "   curl https://github-ai-intelligence.nkostov.workers.dev/"
    echo ""
    echo "2. Check API status:"
    echo "   curl https://github-ai-intelligence.nkostov.workers.dev/api/status"
    echo ""
    echo "3. Monitor logs:"
    echo "   npx wrangler tail"
else
    echo "❌ Deployment failed. Check the error messages above."
    exit 1
fi
