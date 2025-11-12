const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// Test batch analysis with the fix applied
async function testBatchWithFix() {
  console.log('Testing batch analysis with adversarial content fix...\n');

  const API_URL = process.env.VITE_API_URL || 'http://localhost:8787';
  
  // Get a mix of repositories including the problematic one
  const testRepos = [
    { id: '123456', owner: 'langchain-ai', name: 'langchain' },
    { id: '789012', owner: 'openai', name: 'openai-cookbook' },
    { id: '345678', owner: 'elder-plinius', name: 'L1B3RT4S' }, // The problematic repo
    { id: '901234', owner: 'microsoft', name: 'autogen' },
    { id: '567890', owner: 'huggingface', name: 'transformers' }
  ];

  console.log(`Testing batch analysis with ${testRepos.length} repositories`);
  console.log('Including problematic repo: elder-plinius/L1B3RT4S\n');

  const results = {
    successful: [],
    failed: [],
    total: testRepos.length
  };

  // Analyze each repository
  for (const repo of testRepos) {
    console.log(`\nAnalyzing ${repo.owner}/${repo.name}...`);
    
    try {
      const response = await fetch(`${API_URL}/api/analyze/single`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoId: repo.id,
          repoOwner: repo.owner,
          repoName: repo.name,
          force: false
        })
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        console.log(`❌ Failed (HTTP ${response.status}): ${responseText}`);
        results.failed.push({
          repo: `${repo.owner}/${repo.name}`,
          error: `HTTP ${response.status}: ${responseText}`
        });
        continue;
      }

      try {
        const data = JSON.parse(responseText);
        
        // Check if this is a fallback analysis
        if (data.analysis?.metadata?.fallback) {
          console.log(`⚠️  Fallback analysis created (content processing failed)`);
          console.log(`   Summary: ${data.analysis.summary}`);
          console.log(`   Error: ${data.analysis.metadata.error}`);
          results.successful.push({
            repo: `${repo.owner}/${repo.name}`,
            fallback: true,
            error: data.analysis.metadata.error
          });
        } else {
          console.log(`✅ Success - Investment score: ${data.analysis?.scores?.investment || 0}`);
          results.successful.push({
            repo: `${repo.owner}/${repo.name}`,
            fallback: false,
            score: data.analysis?.scores?.investment || 0
          });
        }
      } catch (parseError) {
        console.log(`❌ Failed to parse response: ${parseError.message}`);
        results.failed.push({
          repo: `${repo.owner}/${repo.name}`,
          error: `Parse error: ${parseError.message}`
        });
      }
    } catch (error) {
      console.log(`❌ Request failed: ${error.message}`);
      results.failed.push({
        repo: `${repo.owner}/${repo.name}`,
        error: error.message
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('BATCH ANALYSIS SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total repositories: ${results.total}`);
  console.log(`Successful: ${results.successful.length} (${Math.round(results.successful.length / results.total * 100)}%)`);
  console.log(`Failed: ${results.failed.length} (${Math.round(results.failed.length / results.total * 100)}%)`);
  
  // Check for fallback analyses
  const fallbackCount = results.successful.filter(r => r.fallback).length;
  if (fallbackCount > 0) {
    console.log(`\nFallback analyses: ${fallbackCount}`);
    results.successful.filter(r => r.fallback).forEach(r => {
      console.log(`  - ${r.repo}: ${r.error}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\nFailed repositories:');
    results.failed.forEach(f => {
      console.log(`  - ${f.repo}: ${f.error}`);
    });
  }

  // Verify the fix worked
  const problematicRepo = results.successful.find(r => r.repo === 'elder-plinius/L1B3RT4S');
  if (problematicRepo && problematicRepo.fallback) {
    console.log('\n✅ FIX VERIFIED: Problematic repository handled gracefully with fallback analysis');
    console.log('   The batch analysis can now complete successfully!');
  } else if (results.failed.find(f => f.repo === 'elder-plinius/L1B3RT4S')) {
    console.log('\n❌ FIX NOT WORKING: Problematic repository still causing failures');
  }
}

// Run the test
testBatchWithFix().catch(console.error);
