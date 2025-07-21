// Test script to verify Claude-4 integration
import { ClaudeService } from './src/services/claude.js';
import { RepoAnalyzer } from './src/analyzers/repoAnalyzer.js';
import { CONFIG } from './src/types/index.js';

// Mock environment
const mockEnv = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || 'your-api-key-here'
};

// Mock repository data
const mockRepo = {
  id: 'test-123',
  name: 'langchain',
  owner: 'langchain-ai',
  full_name: 'langchain-ai/langchain',
  description: 'Building applications with LLMs through composability',
  stars: 95000,
  forks: 15000,
  open_issues: 1200,
  language: 'Python',
  topics: ['ai', 'llm', 'agents', 'langchain', 'gpt', 'openai'],
  created_at: '2022-10-17T00:00:00Z',
  updated_at: '2025-01-14T00:00:00Z',
  pushed_at: '2025-01-14T00:00:00Z',
  is_archived: false,
  is_fork: false,
  html_url: 'https://github.com/langchain-ai/langchain',
  clone_url: 'https://github.com/langchain-ai/langchain.git',
  default_branch: 'main'
};

// Mock README content
const mockReadme = `
# 🦜️🔗 LangChain

⚡ Building applications with LLMs through composability ⚡

## Quick Install

\`\`\`bash
pip install langchain
\`\`\`

## What is LangChain?

LangChain is a framework for developing applications powered by language models. It enables applications that:
- Are context-aware: connect a language model to sources of context
- Reason: rely on a language model to reason about how to answer based on provided context

The main value props of LangChain are:
1. Components: abstractions for working with language models
2. Off-the-shelf chains: a structured assembly of components for accomplishing specific higher-level tasks

## Key Features

- 🔗 Chains: Sequences of calls to LLMs or other utilities
- 📚 Data Augmented Generation: Interact with external data sources
- 🤖 Agents: Let LLMs make decisions about which tools to use
- 🧠 Memory: Persist state between calls of a chain/agent
- 🔍 Evaluation: Tools to evaluate the performance of your chains

## Architecture

LangChain provides standard, extendable interfaces and external integrations for the following modules:

### Model I/O
Interface with language models

### Retrieval
Interface with application-specific data

### Chains
Construct sequences of calls

### Agents
Let models choose which tools to use given high-level directives

### Memory
Persist application state between runs of a chain

### Callbacks
Log and stream intermediate steps of any chain

## Community

- Discord: https://discord.gg/langchain
- Twitter: @LangChainAI
- GitHub: https://github.com/langchain-ai/langchain

## Contributing

We welcome contributions! Please see our contributing guidelines.
`;

async function testClaude4() {
  console.log('🧪 Testing Claude-4 Integration\n');
  console.log('Configuration:');
  console.log(`- Claude-4 Enabled: ${CONFIG.claude.useClaude4}`);
  console.log(`- Enhanced Analysis: ${CONFIG.claude.enhancedAnalysis}`);
  console.log(`- High Model: ${CONFIG.claude.models.high}`);
  console.log(`- Medium Model: ${CONFIG.claude.models.medium}`);
  console.log(`- High Threshold: ${CONFIG.claude.thresholds.high}`);
  console.log(`- Medium Threshold: ${CONFIG.claude.thresholds.medium}\n`);

  try {
    // Test 1: Repo Analyzer scoring
    console.log('📊 Test 1: Repository Scoring');
    const analyzer = new RepoAnalyzer(mockEnv);
    const score = await analyzer.analyze(mockRepo);
    console.log('Score:', JSON.stringify(score, null, 2));
    
    // Test 2: Model selection
    console.log('\n🤖 Test 2: Model Selection');
    const recommendedModel = analyzer.getRecommendedModel(score);
    console.log(`Recommended Model: ${recommendedModel}`);
    console.log(`Expected: ${score.total >= 70 ? CONFIG.claude.models.high : CONFIG.claude.models.medium}`);
    
    // Test 3: Claude API call (requires valid API key)
    if (mockEnv.ANTHROPIC_API_KEY !== 'your-api-key-here') {
      console.log('\n🔮 Test 3: Claude-4 Analysis');
      const claudeService = new ClaudeService(mockEnv);
      
      console.log(`Analyzing with model: ${recommendedModel}`);
      const analysis = await claudeService.analyzeRepository(mockRepo, mockReadme, recommendedModel);
      
      console.log('\n📋 Analysis Results:');
      console.log('Basic Scores:', {
        investment: analysis.scores.investment,
        innovation: analysis.scores.innovation,
        team: analysis.scores.team,
        market: analysis.scores.market
      });
      
      console.log('\n🆕 Enhanced Claude-4 Scores:', {
        technical_moat: analysis.scores.technical_moat || 'Not provided',
        scalability: analysis.scores.scalability || 'Not provided',
        developer_adoption: analysis.scores.developer_adoption || 'Not provided'
      });
      
      console.log('\n💡 Enhanced Fields:');
      console.log('- Growth Prediction:', analysis.growth_prediction ? '✅ Present' : '❌ Missing');
      console.log('- Investment Thesis:', analysis.investment_thesis ? '✅ Present' : '❌ Missing');
      console.log('- Competitive Analysis:', analysis.competitive_analysis ? '✅ Present' : '❌ Missing');
      
      console.log('\n📊 Metadata:');
      console.log('- Model Used:', analysis.metadata.model);
      console.log('- Tokens Used:', analysis.metadata.tokens_used);
      console.log('- Estimated Cost: $', analysis.metadata.cost.toFixed(4));
      
      if (analysis.growth_prediction) {
        console.log('\n📈 Growth Prediction Preview:');
        console.log(analysis.growth_prediction.substring(0, 200) + '...');
      }
      
      if (analysis.investment_thesis) {
        console.log('\n💼 Investment Thesis Preview:');
        console.log(analysis.investment_thesis.substring(0, 200) + '...');
      }
      
    } else {
      console.log('\n⚠️  Skipping Test 3: Please set ANTHROPIC_API_KEY environment variable');
      console.log('Run: export ANTHROPIC_API_KEY="your-actual-api-key"');
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

// Run the test
testClaude4();
