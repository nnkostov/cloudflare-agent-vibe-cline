#!/usr/bin/env node

async function testAPI() {
  const urls = [
    'https://github-ai-intelligence.nkostov.workers.dev/api/repos/trending',
    'https://github-ai-intelligence.pages.dev/api/repos/trending'
  ];

  for (const url of urls) {
    console.log(`\nTesting: ${url}`);
    console.log('='.repeat(60));
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.log(`Error: ${response.status} ${response.statusText}`);
        continue;
      }
      
      const data = await response.json();
      console.log(`Total repositories: ${data.total || 0}`);
      
      if (data.repositories && data.repositories.length > 0) {
        const firstRepo = data.repositories[0];
        console.log('\nFirst repository structure:');
        console.log(`- id: ${firstRepo.id}`);
        console.log(`- name: ${firstRepo.name}`);
        console.log(`- owner: ${firstRepo.owner}`);
        console.log(`- full_name: ${firstRepo.full_name}`);
        console.log(`- Has 'name' field: ${firstRepo.name !== undefined}`);
        console.log(`- Has 'owner' field: ${firstRepo.owner !== undefined}`);
        
        console.log('\nAll fields in first repository:');
        console.log(Object.keys(firstRepo).join(', '));
      } else {
        console.log('No repositories returned');
      }
    } catch (error) {
      console.log(`Failed to fetch: ${error.message}`);
    }
  }
}

testAPI();
