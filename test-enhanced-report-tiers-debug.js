const API_BASE = 'https://github-ai-intelligence.nkostov.workers.dev/api';

async function testEnhancedReportTiers() {
  console.log('Testing Enhanced Report Repository Tier Summary...\n');
  
  try {
    const response = await fetch(`${API_BASE}/reports/enhanced`);
    const data = await response.json();
    
    console.log('=== ENHANCED REPORT TIER SUMMARY ANALYSIS ===');
    console.log('Response Status:', response.status);
    
    if (data.tier_summary) {
      console.log('\n--- Tier Summary Data ---');
      console.log('Raw Tier Summary:', JSON.stringify(data.tier_summary, null, 2));
      
      // Calculate totals
      let totalRepos = 0;
      const tierCounts = {};
      
      Object.entries(data.tier_summary).forEach(([tier, tierData]) => {
        const count = tierData.count || 0;
        tierCounts[tier] = count;
        totalRepos += count;
        
        console.log(`Tier ${tier}: ${count} repositories`);
      });
      
      console.log(`\nTotal Repositories Across All Tiers: ${totalRepos}`);
      
      // Check for suspicious patterns
      console.log('\n--- Tier Distribution Analysis ---');
      Object.entries(tierCounts).forEach(([tier, count]) => {
        const percentage = totalRepos > 0 ? ((count / totalRepos) * 100).toFixed(1) : 0;
        console.log(`Tier ${tier}: ${count} repos (${percentage}%)`);
        
        // Flag suspicious distributions
        if (tier === '3' && percentage > 80) {
          console.log(`🚨 SUSPICIOUS: Tier 3 has ${percentage}% of all repos - likely over-classification`);
        }
        if (tier === '1' && percentage > 50) {
          console.log(`🚨 SUSPICIOUS: Tier 1 has ${percentage}% of all repos - unlikely for "Hot Prospects"`);
        }
        if (count === 0) {
          console.log(`⚠️  WARNING: Tier ${tier} has 0 repositories`);
        }
      });
      
    } else {
      console.log('❌ NO TIER SUMMARY DATA FOUND');
      console.log('The tier_summary field is missing from the API response');
    }
    
    // Cross-reference with other system data
    console.log('\n--- Cross-Reference with System Data ---');
    
    try {
      // Check total repository count
      const repoCountResponse = await fetch(`${API_BASE}/repos/count`);
      if (repoCountResponse.ok) {
        const repoCountData = await repoCountResponse.json();
        const systemTotal = repoCountData.count;
        const tierTotal = Object.values(data.tier_summary || {}).reduce((sum, tierData) => sum + (tierData.count || 0), 0);
        
        console.log('Total Repositories in System:', systemTotal);
        console.log('Total Repositories in Tiers:', tierTotal);
        
        if (tierTotal > systemTotal) {
          console.log('🚨 MAJOR ISSUE: Tier total (' + tierTotal + ') > System total (' + systemTotal + ')');
        } else if (tierTotal < systemTotal * 0.8) {
          console.log('⚠️  WARNING: Tier total (' + tierTotal + ') is much less than system total (' + systemTotal + ')');
          console.log('This suggests many repositories are not assigned to any tier');
        } else {
          console.log('✅ Tier total seems reasonable compared to system total');
        }
      }
    } catch (error) {
      console.log('Could not fetch repo count for comparison');
    }
    
    try {
      // Check leaderboard tier distribution for comparison
      const leaderboardResponse = await fetch(`${API_BASE}/leaderboard?tier=1&limit=5`);
      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json();
        console.log('Tier 1 repositories in leaderboard:', leaderboardData.repositories?.length || 0);
        
        const reportedTier1 = data.tier_summary?.['1']?.count || 0;
        if (reportedTier1 > 0 && leaderboardData.repositories?.length === 0) {
          console.log('🚨 INCONSISTENCY: Enhanced Report shows ' + reportedTier1 + ' Tier 1 repos, but leaderboard shows 0');
        }
      }
    } catch (error) {
      console.log('Could not fetch leaderboard for comparison');
    }
    
    // Check other report fields
    console.log('\n--- Other Enhanced Report Fields ---');
    console.log('Available Report Keys:', Object.keys(data));
    console.log('Total Monitored Repos:', data.total_monitored_repos || 'N/A');
    
    if (data.total_monitored_repos) {
      const tierTotal = Object.values(data.tier_summary || {}).reduce((sum, tierData) => sum + (tierData.count || 0), 0);
      if (tierTotal !== data.total_monitored_repos) {
        console.log('🚨 INCONSISTENCY: Tier total (' + tierTotal + ') ≠ Total monitored (' + data.total_monitored_repos + ')');
      }
    }
    
  } catch (error) {
    console.error('Error testing enhanced report tiers:', error);
  }
}

testEnhancedReportTiers();
