// Test script to verify GitHub search is working with all topics
// Run with: node test-github-search-fix.js

require('dotenv').config();
const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  console.error('❌ GITHUB_TOKEN not found in environment variables');
  console.log('Please create a .env file with GITHUB_TOKEN=your_token_here');
  process.exit(1);
}

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

// Topics from CONFIG
const topics = ['ai', 'llm', 'agents', 'machine-learning', 'gpt', 'langchain'];

async function testGitHubSearch() {
  console.log('🔍 Testing GitHub Search with Multiple Topics\n');
  
  try {
    // Test 1: Search with single topic (old behavior)
    console.log('Test 1: Single topic search (old behavior)');
    const singleTopicQuery = `topic:${topics[0]} stars:>=100`;
    console.log(`Query: ${singleTopicQuery}`);
    
    const singleTopicResponse = await octokit.search.repos({
      q: singleTopicQuery,
      sort: 'stars',
      order: 'desc',
      per_page: 5,
    });
    
    console.log(`✅ Found ${singleTopicResponse.data.total_count} repositories with topic "${topics[0]}"`);
    console.log('Top 5 results:');
    singleTopicResponse.data.items.forEach((repo, i) => {
      console.log(`  ${i + 1}. ${repo.full_name} (⭐ ${repo.stargazers_count})`);
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 2: Search with all topics (new behavior)
    console.log('Test 2: Multiple topics search (new behavior)');
    const multiTopicQuery = '(' + topics.map(t => `topic:${t}`).join(' OR ') + ') stars:>=100';
    console.log(`Query: ${multiTopicQuery}`);
    
    const multiTopicResponse = await octokit.search.repos({
      q: multiTopicQuery,
      sort: 'stars',
      order: 'desc',
      per_page: 30,
    });
    
    console.log(`✅ Found ${multiTopicResponse.data.total_count} repositories across all topics`);
    console.log(`Returned ${multiTopicResponse.data.items.length} repositories in this request\n`);
    
    // Analyze topic distribution
    const topicDistribution = {};
    multiTopicResponse.data.items.forEach(repo => {
      if (repo.topics && repo.topics.length > 0) {
        repo.topics.forEach(topic => {
          if (topics.includes(topic)) {
            topicDistribution[topic] = (topicDistribution[topic] || 0) + 1;
          }
        });
      }
    });
    
    console.log('Topic distribution in results:');
    Object.entries(topicDistribution)
      .sort((a, b) => b[1] - a[1])
      .forEach(([topic, count]) => {
        console.log(`  ${topic}: ${count} repositories`);
      });
    
    console.log('\nTop 10 repositories:');
    multiTopicResponse.data.items.slice(0, 10).forEach((repo, i) => {
      const relevantTopics = repo.topics ? repo.topics.filter(t => topics.includes(t)) : [];
      console.log(`  ${i + 1}. ${repo.full_name}`);
      console.log(`     ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count} | Topics: ${relevantTopics.join(', ')}`);
      if (repo.description) {
        console.log(`     ${repo.description.substring(0, 80)}${repo.description.length > 80 ? '...' : ''}`);
      }
    });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 3: Check for diversity in results
    console.log('Test 3: Result Diversity Analysis');
    const uniqueOwners = new Set(multiTopicResponse.data.items.map(repo => repo.owner.login));
    const languages = {};
    multiTopicResponse.data.items.forEach(repo => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    });
    
    console.log(`Unique repository owners: ${uniqueOwners.size}`);
    console.log('Language distribution:');
    Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .forEach(([lang, count]) => {
        console.log(`  ${lang}: ${count} repositories`);
      });
    
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 4: Check rate limits
    console.log('Test 4: GitHub API Rate Limits');
    const rateLimit = await octokit.rateLimit.get();
    console.log(`Search API remaining: ${rateLimit.data.resources.search.remaining}/${rateLimit.data.resources.search.limit}`);
    console.log(`Core API remaining: ${rateLimit.data.rate.remaining}/${rateLimit.data.rate.limit}`);
    const searchReset = new Date(rateLimit.data.resources.search.reset * 1000);
    console.log(`Search limit resets at: ${searchReset.toLocaleString()}`);
    
    console.log('\n✅ GitHub search test completed successfully!');
    console.log('\nSummary:');
    console.log(`- Single topic search found: ${singleTopicResponse.data.total_count} repos`);
    console.log(`- Multi-topic search found: ${multiTopicResponse.data.total_count} repos`);
    console.log(`- Improvement: ${((multiTopicResponse.data.total_count / singleTopicResponse.data.total_count - 1) * 100).toFixed(1)}% more repositories discovered`);
    
  } catch (error) {
    console.error('❌ Error during GitHub search test:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testGitHubSearch();
