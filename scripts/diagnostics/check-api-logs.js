const { D1Database } = require('@cloudflare/workers-types');

async function checkAPILogs() {
  console.log('Checking API logs in database...\n');

  try {
    // Check recent logs
    const recentLogs = await DB.prepare(`
      SELECT 
        timestamp,
        log_message,
        api_calls
      FROM tail_logs
      WHERE timestamp > datetime('now', '-24 hours')
        AND (
          log_message LIKE '%GitHub%' 
          OR log_message LIKE '%Claude%'
          OR log_message LIKE '%API%'
          OR api_calls IS NOT NULL
        )
      ORDER BY timestamp DESC
      LIMIT 20
    `).all();

    console.log('Recent API-related logs:');
    console.log('========================');
    
    if (recentLogs.results.length === 0) {
      console.log('No API-related logs found in the last 24 hours');
    } else {
      recentLogs.results.forEach(log => {
        console.log(`\nTimestamp: ${log.timestamp}`);
        console.log(`Message: ${log.log_message}`);
        console.log(`API Calls: ${log.api_calls || 'null'}`);
      });
    }

    // Check API calls summary
    const apiCallsSummary = await DB.prepare(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN api_calls IS NOT NULL THEN 1 END) as logs_with_api_calls,
        COUNT(CASE WHEN log_message LIKE '%GitHub%' THEN 1 END) as github_mentions,
        COUNT(CASE WHEN log_message LIKE '%Claude%' THEN 1 END) as claude_mentions,
        COUNT(CASE WHEN log_message LIKE '%search%' THEN 1 END) as search_mentions
      FROM tail_logs
      WHERE timestamp > datetime('now', '-24 hours')
    `).first();

    console.log('\n\nAPI Logs Summary (Last 24 hours):');
    console.log('==================================');
    console.log(`Total logs: ${apiCallsSummary.total_logs}`);
    console.log(`Logs with api_calls field: ${apiCallsSummary.logs_with_api_calls}`);
    console.log(`GitHub mentions: ${apiCallsSummary.github_mentions}`);
    console.log(`Claude mentions: ${apiCallsSummary.claude_mentions}`);
    console.log(`Search mentions: ${apiCallsSummary.search_mentions}`);

    // Check what patterns exist in logs
    const patterns = await DB.prepare(`
      SELECT DISTINCT 
        SUBSTR(log_message, 1, 50) as message_start,
        COUNT(*) as count
      FROM tail_logs
      WHERE timestamp > datetime('now', '-24 hours')
        AND log_message IS NOT NULL
      GROUP BY message_start
      ORDER BY count DESC
      LIMIT 20
    `).all();

    console.log('\n\nMost common log message patterns:');
    console.log('==================================');
    patterns.results.forEach(pattern => {
      console.log(`${pattern.count}x: ${pattern.message_start}...`);
    });

    // Check if tail worker is even running
    const tailWorkerLogs = await DB.prepare(`
      SELECT COUNT(*) as count
      FROM tail_logs
      WHERE timestamp > datetime('now', '-1 hour')
        AND script_name = 'github-ai-intelligence-tail'
    `).first();

    console.log('\n\nTail Worker Status:');
    console.log('===================');
    console.log(`Tail worker logs in last hour: ${tailWorkerLogs.count}`);

  } catch (error) {
    console.error('Error checking API logs:', error);
  }
}

// Run the check
checkAPILogs().catch(console.error);
