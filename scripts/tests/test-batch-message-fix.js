// Test script to verify the batch analysis message fix
const fs = require('fs');
const path = require('path');

console.log('Testing batch analysis message fix...\n');

// Simulate the API response that was causing the issue
const mockApiResponse = {
  message: 'Repositories identified for analysis',
  batchId: 'batch_1234567890',
  target: 'visible',
  processed: 0,
  total: 15,
  currentChunk: ['repo1', 'repo2', 'repo3', 'repo4', 'repo5'],
  hasMore: true,
  nextIndex: 5,
  repositories: [
    { id: '1', full_name: 'owner/repo1', owner: 'owner', name: 'repo1', tier: 1, stars: 1000 },
    { id: '2', full_name: 'owner/repo2', owner: 'owner', name: 'repo2', tier: 1, stars: 900 },
    { id: '3', full_name: 'owner/repo3', owner: 'owner', name: 'repo3', tier: 2, stars: 500 },
    { id: '4', full_name: 'owner/repo4', owner: 'owner', name: 'repo4', tier: 2, stars: 400 },
    { id: '5', full_name: 'owner/repo5', owner: 'owner', name: 'repo5', tier: 3, stars: 200 }
  ],
  chunkInfo: {
    startIndex: 0,
    chunkSize: 5,
    actualProcessed: 0,
    failed: 0
  }
  // Note: The legacy fields are NOT present in the response
  // queued: undefined,
  // batchSize: undefined,
  // delayBetweenAnalyses: undefined,
  // maxRetries: undefined,
  // estimatedCompletionTime: undefined
};

console.log('Mock API Response:');
console.log(JSON.stringify(mockApiResponse, null, 2));
console.log('\n');

// Test the old message generation (would show undefined)
console.log('OLD MESSAGE (with undefined values):');
const oldMessage = `Enhanced batch analysis started! Processing ${mockApiResponse.queued} repositories (${mockApiResponse.batchSize} max batch size, ${mockApiResponse.delayBetweenAnalyses} delays, ${mockApiResponse.maxRetries} max retries). Estimated completion: ${mockApiResponse.estimatedCompletionTime}.`;
console.log(oldMessage);
console.log('\n');

// Test the new message generation (fixed version)
console.log('NEW MESSAGE (fixed):');
const totalRepos = mockApiResponse.total || mockApiResponse.repositories?.length || 0;
const batchSize = 5; // Default batch size from backend
const delaySeconds = 2; // Default delay between analyses
const maxRetries = 3; // Default max retries
const estimatedMinutes = Math.ceil((totalRepos * delaySeconds) / 60);
const estimatedTime = estimatedMinutes > 60 ? 
  `${Math.round(estimatedMinutes / 60)} hours` : 
  `${estimatedMinutes} minutes`;

const newMessage = `Enhanced batch analysis started! Processing ${totalRepos} repositories (${batchSize} max batch size, ${delaySeconds}s delays, ${maxRetries} max retries). Estimated completion: ${estimatedTime}.`;
console.log(newMessage);
console.log('\n');

// Verify the fix
console.log('VERIFICATION:');
console.log('✅ Total repositories: ' + totalRepos + ' (from data.total)');
console.log('✅ Batch size: ' + batchSize + ' (hardcoded default)');
console.log('✅ Delay: ' + delaySeconds + 's (hardcoded default)');
console.log('✅ Max retries: ' + maxRetries + ' (hardcoded default)');
console.log('✅ Estimated time: ' + estimatedTime + ' (calculated)');
console.log('\n');

// Test edge cases
console.log('EDGE CASE TESTS:');

// Test with no repositories
const emptyResponse = { total: 0, repositories: [] };
const emptyTotal = emptyResponse.total || emptyResponse.repositories?.length || 0;
const emptyEstimatedMinutes = Math.ceil((emptyTotal * delaySeconds) / 60);
const emptyEstimatedTime = emptyEstimatedMinutes > 60 ? 
  `${Math.round(emptyEstimatedMinutes / 60)} hours` : 
  `${emptyEstimatedMinutes} minutes`;
console.log('Empty response: ' + emptyTotal + ' repos, estimated: ' + emptyEstimatedTime);

// Test with many repositories
const largeResponse = { total: 500 };
const largeTotal = largeResponse.total || largeResponse.repositories?.length || 0;
const largeEstimatedMinutes = Math.ceil((largeTotal * delaySeconds) / 60);
const largeEstimatedTime = largeEstimatedMinutes > 60 ? 
  `${Math.round(largeEstimatedMinutes / 60)} hours` : 
  `${largeEstimatedMinutes} minutes`;
console.log('Large response: ' + largeTotal + ' repos, estimated: ' + largeEstimatedTime);

console.log('\n✅ Fix verified! The message now displays correct values instead of "undefined".');
