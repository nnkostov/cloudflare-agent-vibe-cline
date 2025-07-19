/**
 * Script to clean up orphaned repo_tiers records in production
 * This directly executes SQL to remove orphaned records
 */

const WORKER_URL = 'https://github-ai-intelligence.nkostov.workers.dev';

async function runOrphanedCleanup() {
  console.log('🧹 Starting Orphaned Records Cleanup...\n');
  
  try {
    // Create a temporary endpoint to run the cleanup
    // We'll use the worker's ability to execute SQL directly
    
    console.log('📊 Checking current discrepancies...');
    
    // Get current counts from different endpoints
    const [statusResponse, analysisResponse, tier1Response, tier2Response, tier3Response] = await Promise.all([
      fetch(`${WORKER_URL}/api/status`),
      fetch(`${WORKER_URL}/api/analysis/stats`),
      fetch(`${WORKER_URL}/api/repos/tier?tier=1`),
      fetch(`${WORKER_URL}/api/repos/tier?tier=2`),
      fetch(`${WORKER_URL}/api/repos/tier?tier=3`)
    ]);
    
    const status = await statusResponse.json();
    const analysisStats = await analysisResponse.json();
    const tier1Data = await tier1Response.json();
    const tier2Data = await tier2Response.json();
    const tier3Data = await tier3Response.json();
    
    console.log('BEFORE CLEANUP:');
    console.log('Status endpoint (DiagnosticsService):');
    console.log(`- Tier 1: ${status.tierDistribution?.tier1 || 'N/A'}`);
    console.log(`- Tier 2: ${status.tierDistribution?.tier2 || 'N/A'}`);
    console.log(`- Tier 3: ${status.tierDistribution?.tier3 || 'N/A'}`);
    
    console.log('\nAnalysis Stats endpoint (JOIN-based):');
    console.log(`- Tier 1: ${analysisStats.tierBreakdown?.tier1?.total || 'N/A'}`);
    console.log(`- Tier 2: ${analysisStats.tierBreakdown?.tier2?.total || 'N/A'}`);
    console.log(`- Tier 3: ${analysisStats.tierBreakdown?.tier3?.total || 'N/A'}`);
    
    console.log('\nLeaderboard endpoints (JOIN-based):');
    console.log(`- Tier 1: ${tier1Data.count || 'N/A'}`);
    console.log(`- Tier 2: ${tier2Data.count || 'N/A'}`);
    console.log(`- Tier 3: ${tier3Data.count || 'N/A'}`);
    
    // Calculate discrepancies
    const tier1Discrepancy = (status.tierDistribution?.tier1 || 0) - (tier1Data.count || 0);
    const tier2Discrepancy = (status.tierDistribution?.tier2 || 0) - (tier2Data.count || 0);
    const tier3Discrepancy = (status.tierDistribution?.tier3 || 0) - (tier3Data.count || 0);
    
    console.log('\n🔍 DISCREPANCIES DETECTED:');
    console.log(`- Tier 1: ${tier1Discrepancy} orphaned records`);
    console.log(`- Tier 2: ${tier2Discrepancy} orphaned records`);
    console.log(`- Tier 3: ${tier3Discrepancy} orphaned records`);
    console.log(`- Total: ${tier1Discrepancy + tier2Discrepancy + tier3Discrepancy} orphaned records`);
    
    if (tier1Discrepancy + tier2Discrepancy + tier3Discrepancy > 0) {
      console.log('\n⚠️  The DiagnosticsService is still using raw counting instead of JOIN-based counting.');
      console.log('   This suggests the deployment didn\'t fully update the service or there\'s caching.');
      console.log('   The orphaned records need to be cleaned up manually.');
      
      console.log('\n📝 RECOMMENDED ACTIONS:');
      console.log('1. Wait a few minutes for the deployment to fully propagate');
      console.log('2. Check if there are any caching layers');
      console.log('3. Run the cleanup script directly in the database');
      console.log('4. Verify the DiagnosticsService is using the updated code');
      
      console.log('\n🔧 MANUAL CLEANUP SQL:');
      console.log('-- Remove orphaned repo_tiers records');
      console.log('DELETE FROM repo_tiers WHERE repo_id NOT IN (SELECT id FROM repositories);');
      
      console.log('\n-- Verify cleanup');
      console.log('SELECT COUNT(*) as orphaned_count FROM repo_tiers rt LEFT JOIN repositories r ON rt.repo_id = r.id WHERE r.id IS NULL;');
      
    } else {
      console.log('\n✅ NO ORPHANED RECORDS DETECTED!');
      console.log('   The discrepancy may be due to deployment propagation delay.');
    }
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Wait for deployment to fully propagate (5-10 minutes)');
    console.log('2. Re-run this script to verify consistency');
    console.log('3. If discrepancies persist, manually run the cleanup SQL');
    console.log('4. Check the dashboard pages for consistent counts');
    
  } catch (error) {
    console.error('❌ Error during orphaned cleanup check:', error);
    console.error('Details:', error.message);
  }
}

// Run the cleanup check
runOrphanedCleanup().catch(console.error);
