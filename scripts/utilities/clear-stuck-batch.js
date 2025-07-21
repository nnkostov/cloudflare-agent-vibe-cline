#!/usr/bin/env node

/**
 * Script to clear stuck batch data from the production system
 */

async function clearStuckBatch() {
  const API_URL = 'https://github-ai-intelligence.nkostov.workers.dev/api';
  
  console.log('🧹 Clearing stuck batch data...\n');
  
  try {
    // Clear all batch data
    const response = await fetch(`${API_URL}/analyze/batch/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to clear batch data: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('✅ Success:', result.message);
    console.log(`   Batches cleared: ${result.batchesCleared}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
clearStuckBatch();
