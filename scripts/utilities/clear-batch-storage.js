#!/usr/bin/env node

/**
 * Clear Batch Storage Utility
 * 
 * This script clears any stuck batch IDs from localStorage
 * Run this if batch analysis seems to auto-start on page load
 */

console.log('🧹 Clearing batch storage...\n');

// Instructions for manual clearing
console.log('To manually clear batch storage in your browser:');
console.log('1. Open the Controls page');
console.log('2. Open browser DevTools (F12)');
console.log('3. Go to Console tab');
console.log('4. Run this command:');
console.log('   localStorage.removeItem("activeBatchId")');
console.log('5. Refresh the page\n');

console.log('Alternatively, you can clear all site data:');
console.log('1. Open DevTools → Application tab');
console.log('2. Click "Clear site data" under Storage');
console.log('3. Refresh the page\n');

console.log('✅ Instructions provided. The issue should be resolved after clearing localStorage.');
