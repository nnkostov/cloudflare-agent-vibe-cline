/**
 * Test script for the Enhanced Data Collection System
 * Run this after deployment to validate all features are working correctly
 */

const BASE_URL = process.env.WORKER_URL || 'http://localhost:8787';

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Helper function to make API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${BASE_URL}/api${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error || response.statusText}`);
    }
    
    return { success: true, data, status: response.status };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Test functions
const tests = {
  // Test 1: Check system status
  async checkStatus() {
    console.log(`${colors.blue}Test 1: Checking system status...${colors.reset}`);
    const result = await apiCall('/status');
    
    if (result.success) {
      console.log(`${colors.green}✓ System is active${colors.reset}`);
      console.log(`  - GitHub rate limit remaining: ${result.data.githubRateLimit.remaining}`);
      console.log(`  - Daily stats:`, result.data.dailyStats);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to get status: ${result.error}${colors.reset}`);
      return false;
    }
  },

  // Test 2: Initialize agent
  async initializeAgent() {
    console.log(`\n${colors.blue}Test 2: Initializing agent...${colors.reset}`);
    const result = await apiCall('/agent/init', 'POST');
    
    if (result.success) {
      console.log(`${colors.green}✓ Agent initialized${colors.reset}`);
      console.log(`  - Next scheduled run: ${result.data.nextRun}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to initialize: ${result.error}${colors.reset}`);
      return false;
    }
  },

  // Test 3: Test tier endpoints
  async testTierEndpoints() {
    console.log(`\n${colors.blue}Test 3: Testing tier endpoints...${colors.reset}`);
    let allPassed = true;
    
    for (const tier of [1, 2, 3]) {
      const result = await apiCall(`/repos/tier?tier=${tier}`);
      
      if (result.success) {
        console.log(`${colors.green}✓ Tier ${tier}: ${result.data.count} repositories${colors.reset}`);
        if (result.data.repos.length > 0) {
          console.log(`  - Sample: ${result.data.repos[0].full_name}`);
        }
      } else {
        console.log(`${colors.red}✗ Failed to get tier ${tier}: ${result.error}${colors.reset}`);
        allPassed = false;
      }
    }
    
    return allPassed;
  },

  // Test 4: Test comprehensive scan (limited)
  async testComprehensiveScan() {
    console.log(`\n${colors.blue}Test 4: Testing comprehensive scan...${colors.reset}`);
    console.log(`${colors.yellow}Note: This will trigger a real scan - use sparingly!${colors.reset}`);
    
    // Skip in production unless explicitly enabled
    if (process.env.SKIP_SCAN_TEST === 'true') {
      console.log(`${colors.yellow}⚠ Skipping comprehensive scan test (SKIP_SCAN_TEST=true)${colors.reset}`);
      return true;
    }
    
    const result = await apiCall('/scan/comprehensive', 'POST');
    
    if (result.success) {
      console.log(`${colors.green}✓ Comprehensive scan completed${colors.reset}`);
      console.log(`  - Duration: ${result.data.duration}`);
      console.log(`  - Tier 1 repos: ${result.data.tiers.tier1.length}`);
      console.log(`  - Tier 2 repos: ${result.data.tiers.tier2.length}`);
      console.log(`  - Tier 3 repos: ${result.data.tiers.tier3.length}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to run scan: ${result.error}${colors.reset}`);
      return false;
    }
  },

  // Test 5: Test enhanced metrics
  async testEnhancedMetrics() {
    console.log(`\n${colors.blue}Test 5: Testing enhanced metrics...${colors.reset}`);
    
    // First, get a repo from tier 1
    const tierResult = await apiCall('/repos/tier?tier=1');
    
    if (!tierResult.success || tierResult.data.repos.length === 0) {
      console.log(`${colors.yellow}⚠ No tier 1 repos found to test metrics${colors.reset}`);
      return true;
    }
    
    const repoId = tierResult.data.repos[0].id;
    const result = await apiCall(`/metrics/comprehensive?repo_id=${repoId}`);
    
    if (result.success) {
      console.log(`${colors.green}✓ Got comprehensive metrics for ${tierResult.data.repos[0].full_name}${colors.reset}`);
      console.log(`  - Commits: ${result.data.commits.length}`);
      console.log(`  - Releases: ${result.data.releases.length}`);
      console.log(`  - Star history entries: ${result.data.stars.length}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to get metrics: ${result.error}${colors.reset}`);
      return false;
    }
  },

  // Test 6: Test enhanced report
  async testEnhancedReport() {
    console.log(`\n${colors.blue}Test 6: Testing enhanced report...${colors.reset}`);
    const result = await apiCall('/reports/enhanced');
    
    if (result.success) {
      console.log(`${colors.green}✓ Enhanced report generated${colors.reset}`);
      console.log(`  - Total monitored repos: ${result.data.total_monitored_repos}`);
      console.log(`  - High growth repos: ${result.data.high_growth_repos_with_metrics.length}`);
      console.log(`  - Recent alerts: ${result.data.recent_alerts.length}`);
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to generate report: ${result.error}${colors.reset}`);
      return false;
    }
  },

  // Test 7: Test basic scan
  async testBasicScan() {
    console.log(`\n${colors.blue}Test 7: Testing basic scan...${colors.reset}`);
    const result = await apiCall('/scan', 'POST', {
      topics: ['ai', 'machine-learning'],
      minStars: 100
    });
    
    if (result.success) {
      console.log(`${colors.green}✓ Basic scan completed${colors.reset}`);
      console.log(`  - Repositories found: ${result.data.repositoriesFound}`);
      if (result.data.repositories.length > 0) {
        console.log(`  - Top repo: ${result.data.repositories[0].full_name} (${result.data.repositories[0].stars} stars)`);
      }
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to run scan: ${result.error}${colors.reset}`);
      return false;
    }
  },

  // Test 8: Test repository analysis
  async testRepoAnalysis() {
    console.log(`\n${colors.blue}Test 8: Testing repository analysis...${colors.reset}`);
    
    // Use a well-known repo for testing
    const result = await apiCall('/analyze', 'POST', {
      repoOwner: 'langchain-ai',
      repoName: 'langchain',
      force: true
    });
    
    if (result.success) {
      console.log(`${colors.green}✓ Repository analyzed${colors.reset}`);
      if (result.data.analysis) {
        console.log(`  - Investment score: ${result.data.analysis.scores.investment}`);
        console.log(`  - Technical moat: ${result.data.analysis.scores.technical_moat}`);
        console.log(`  - Model used: ${result.data.analysis.model_used}`);
      }
      return true;
    } else {
      console.log(`${colors.red}✗ Failed to analyze: ${result.error}${colors.reset}`);
      return false;
    }
  }
};

// Main test runner
async function runTests() {
  console.log(`${colors.blue}=== Enhanced Data Collection System Test Suite ===${colors.reset}`);
  console.log(`Testing against: ${BASE_URL}\n`);
  
  const results = [];
  
  // Run tests in sequence
  for (const [name, test] of Object.entries(tests)) {
    try {
      const passed = await test();
      results.push({ name, passed });
      
      // Add delay between tests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`${colors.red}✗ Test error: ${error.message}${colors.reset}`);
      results.push({ name, passed: false });
    }
  }
  
  // Summary
  console.log(`\n${colors.blue}=== Test Summary ===${colors.reset}`);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}✓ All tests passed! The enhanced system is working correctly.${colors.reset}`);
  } else {
    console.log(`\n${colors.red}✗ Some tests failed. Please check the logs above.${colors.reset}`);
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});
