require('dotenv').config();

async function testSingleRepoAnalysis(owner, name) {
  console.log(`\n🧪 Testing analysis for repository: ${owner}/${name}\n`);

  const apiUrl = process.env.VITE_API_URL || 'http://localhost:8787';
  
  try {
    // Step 1: Check if repository exists in GitHub
    console.log('1️⃣ Checking GitHub API...');
    const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!githubResponse.ok) {
      console.error(`❌ GitHub API Error: ${githubResponse.status} ${githubResponse.statusText}`);
      const error = await githubResponse.text();
      console.error('Response:', error);
      return;
    }

    const repoData = await githubResponse.json();
    console.log('✅ Repository found on GitHub:');
    console.log(`  - Full name: ${repoData.full_name}`);
    console.log(`  - Stars: ${repoData.stargazers_count}`);
    console.log(`  - Language: ${repoData.language || 'None'}`);
    console.log(`  - Description: ${repoData.description || 'None'}`);
    console.log(`  - Topics: ${repoData.topics?.join(', ') || 'None'}`);
    console.log(`  - Private: ${repoData.private}`);
    console.log(`  - Archived: ${repoData.archived}`);

    // Step 2: Check for README
    console.log('\n2️⃣ Checking for README...');
    const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${name}/readme`, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!readmeResponse.ok) {
      console.error(`⚠️  No README found: ${readmeResponse.status}`);
    } else {
      const readmeData = await readmeResponse.json();
      console.log('✅ README found:');
      console.log(`  - Name: ${readmeData.name}`);
      console.log(`  - Size: ${readmeData.size} bytes`);
      
      // Get README content
      const readmeContent = atob(readmeData.content);
      console.log(`  - First 200 chars: ${readmeContent.substring(0, 200)}...`);
      
      // Check for problematic content
      if (readmeContent.includes('```') && readmeContent.split('```').length % 2 === 0) {
        console.log('  ⚠️  WARNING: Unmatched code blocks in README');
      }
      if (readmeContent.includes('"') || readmeContent.includes("'")) {
        console.log('  ⚠️  WARNING: Contains quotes that might need escaping');
      }
    }

    // Step 3: Try to analyze via API
    console.log('\n3️⃣ Testing analysis via API...');
    const analyzeResponse = await fetch(`${apiUrl}/api/analyze/single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        repoOwner: owner,
        repoName: name,
        force: true
      })
    });

    if (!analyzeResponse.ok) {
      console.error(`❌ Analysis API Error: ${analyzeResponse.status}`);
      const error = await analyzeResponse.text();
      console.error('Response:', error);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(error);
        console.error('\nError details:', errorData);
        
        if (errorData.error?.includes('threshold')) {
          console.log('\n💡 This repository might not meet the scoring threshold for deep analysis');
        }
        if (errorData.error?.includes('rate limit')) {
          console.log('\n💡 Rate limit issue detected');
        }
      } catch (e) {
        // Not JSON error
      }
    } else {
      const result = await analyzeResponse.json();
      console.log('✅ Analysis successful!');
      console.log('\nAnalysis result:');
      console.log(JSON.stringify(result, null, 2));
    }

    // Step 4: Check repository score
    console.log('\n4️⃣ Checking repository score...');
    // Simulate basic scoring to see if it meets threshold
    const daysSinceCreation = (Date.now() - new Date(repoData.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const growthVelocity = repoData.stargazers_count / Math.max(1, daysSinceCreation);
    
    console.log('Basic metrics:');
    console.log(`  - Days since creation: ${Math.round(daysSinceCreation)}`);
    console.log(`  - Growth velocity: ${growthVelocity.toFixed(2)} stars/day`);
    console.log(`  - Fork ratio: ${(repoData.forks_count / Math.max(1, repoData.stargazers_count)).toFixed(2)}`);
    
    // Estimate if it would pass threshold
    const estimatedScore = Math.min(100, 
      (repoData.stargazers_count / 100) * 20 + // Stars component
      growthVelocity * 10 + // Growth component
      (repoData.forks_count / Math.max(1, repoData.stargazers_count)) * 100 * 10 // Engagement
    );
    
    console.log(`  - Estimated score: ${estimatedScore.toFixed(1)}/100`);
    if (estimatedScore < 50) {
      console.log('  ⚠️  This repository might not meet the minimum threshold for AI analysis');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.error(error.stack);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  console.log('Usage: node test-single-repo-analysis.js <owner> <name>');
  console.log('Example: node test-single-repo-analysis.js "facebook" "react"');
  process.exit(1);
}

const [owner, name] = args;
testSingleRepoAnalysis(owner, name).catch(console.error);
