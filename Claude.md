# Claude's Reference Guide: GitHub AI Intelligence Agent

## 🎯 Project Overview

This is a **Cloudflare Workers-based AI agent** that monitors GitHub for high-potential AI/ML projects and provides VC-grade investment analysis using Claude AI models. Think of it as an automated scout for venture capitalists interested in AI/ML opportunities.

### Core Purpose
- **Discover** trending AI/ML repositories on GitHub
- **Analyze** their investment potential using Claude AI
- **Alert** on high-growth opportunities
- **Generate** investment reports and insights

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub API     │────▶│  Cloudflare      │────▶│  Claude API     │
│                 │     │  Workers         │     │  (Opus/Sonnet)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  D1 Database     │
                        │  R2 Storage      │
                        └──────────────────┘
```

### Key Components

1. **Main Worker** (`src/index.ts`)
   - Entry point for all HTTP requests
   - Routes to appropriate handlers
   - CORS handling

2. **Durable Object** (`src/agents/GitHubAgent.ts`)
   - Stateful agent for scheduled operations
   - Handles alarms for periodic scanning
   - Orchestrates the analysis workflow

3. **Services** (`src/services/`)
   - `github.ts`: GitHub API interactions
   - `claude.ts`: Claude AI integration
   - `storage.ts`: D1 & R2 operations
   - `base.ts`: Common service functionality

4. **Analyzer** (`src/analyzers/repoAnalyzer.ts`)
   - Scoring algorithm implementation
   - Model selection logic

## 📁 Quick File Reference

### Configuration & Setup
- `wrangler.toml` - Cloudflare Workers config (D1, R2, Durable Objects)
- `.env.example` - Required environment variables template
- `schema.sql` - Database schema for D1
- `src/types/index.ts` - All TypeScript types & CONFIG object

### Core Logic Files
- `src/agents/GitHubAgent.ts` - Main agent logic, scheduling, orchestration
- `src/analyzers/repoAnalyzer.ts` - Scoring algorithm (growth, engagement, quality)
- `src/services/claude.ts` - Claude prompts and response parsing
- `src/services/github.ts` - GitHub API client (search, metrics, contributors)
- `src/services/storage.ts` - Database operations (save/retrieve repos, analyses, alerts)

### API Endpoints (in `src/index.ts`)
- `/api/agent/init` - Initialize scheduled scanning
- `/api/scan` - Manual repository scan
- `/api/analyze` - Analyze specific repository
- `/api/repos/trending` - Get trending repositories
- `/api/alerts` - Recent alerts
- `/api/reports/daily` - Daily investment report
- `/api/status` - System status

## 🔄 Key Workflows

### 1. Repository Discovery Flow
```
GitHub Search API → Filter by topics/stars → Save to D1 → Calculate scores
```

### 2. Analysis Flow
```
High-score repo → Get README → Claude analysis → Save results → Generate alerts
```

### 3. Scheduled Scanning (every 6 hours)
```
Alarm triggers → Scan GitHub → Analyze top repos → Set next alarm
```

## 💡 Important Concepts

### Scoring System
- **Total Score** = 0.4×Growth + 0.3×Engagement + 0.3×Quality
- **Growth**: Based on stars, forks, contributors
- **Engagement**: Fork ratio, issues, AI-related topics
- **Quality**: Documentation, activity, language

### Claude Model Selection
- **Score ≥ 70**: Claude-Opus-4 (deep analysis) - `claude-opus-4-20250514`
- **Score 50-69**: Claude-Sonnet-4 (standard analysis) - `claude-sonnet-4-20250514`
- **Score < 50**: Claude-3.5-Haiku (quick scan) - `claude-3-5-haiku-20241022`

**IMPORTANT**: The system now uses the official Claude 4 model names:
- `claude-opus-4-20250514` (NOT `claude-opus-4`)
- `claude-sonnet-4-20250514` (NOT `claude-sonnet-4`)
- These are the latest and most capable Claude models available.

### Analysis Output
- Investment score (0-100)
- Innovation, team, market scores
- Recommendation: strong-buy | buy | watch | pass
- Enhanced fields (Opus-4): technical moat, scalability, growth prediction

## 🛠️ Common Development Tasks

### Adding a New API Endpoint
1. Add handler in `src/index.ts` under `directHandlers`
2. Or add to Durable Object in `src/agents/GitHubAgent.ts`
3. Update the endpoints list in default response

### Modifying Scoring Algorithm
1. Edit `src/analyzers/repoAnalyzer.ts`
2. Update `calculateFactors()` method
3. Adjust weights in `src/types/index.ts` SCORING config

### Changing Claude Prompts
1. Edit `src/services/claude.ts`
2. Modify `buildPrompt()` or `buildEnhancedPrompt()`
3. Update `parseResponse()` if output structure changes

### Adding New Database Fields
1. Update `schema.sql`
2. Modify types in `src/types/index.ts`
3. Update storage methods in `src/services/storage.ts`
4. Run migration with wrangler

## ⚠️ Gotchas & Best Practices

### API Rate Limits
- GitHub: Check rate limit with `checkRateLimit()`
- Claude: Implement delays between analyses (2s currently)
- Use caching to minimize API calls (7-day cache)

### Cloudflare Workers Limits
- 10ms CPU time per request (use Durable Objects for longer tasks)
- Subrequest limits: batch operations when possible
- Memory: Keep response sizes reasonable

### Database Considerations
- D1 has query size limits
- Use batch operations for bulk inserts
- Archive detailed data to R2

### Error Handling
- All services extend BaseService with `handleError()`
- Log errors but don't expose internals to users
- Gracefully handle API failures

## 🚀 Deployment Checklist

1. **Environment Setup**
   ```bash
   wrangler secret put GITHUB_TOKEN
   wrangler secret put ANTHROPIC_API_KEY
   ```

2. **Database Creation**
   ```bash
   wrangler d1 create github-agent-db
   wrangler d1 execute github-agent-db --file=./schema.sql
   ```

3. **R2 Bucket**
   ```bash
   wrangler r2 bucket create github-agent-storage
   ```

4. **Update wrangler.toml** with IDs from above commands

5. **Deploy**
   ```bash
   npm run deploy
   ```

## 📊 Monitoring & Debugging

### Check System Status
- GET `/api/status` - Shows rate limits, daily stats
- Check D1 database directly via Cloudflare dashboard
- Monitor Claude API usage for cost tracking

### Common Issues
- **No analyses running**: Check if agent is initialized (`/api/agent/init`)
- **Missing data**: Verify API keys are set correctly
- **High costs**: Adjust score thresholds in CONFIG

## 🔮 Future Enhancement Ideas

1. **Additional Data Sources**
   - npm/PyPI download stats
   - Social media mentions
   - Developer forum activity

2. **Enhanced Analysis**
   - Code quality metrics
   - Security vulnerability scanning
   - License compatibility checks

3. **Notification Channels**
   - Slack/Discord webhooks
   - Email digests
   - RSS feeds

4. **UI Dashboard**
   - Real-time monitoring
   - Historical trends
   - Portfolio tracking

---

*Remember: This system prioritizes analysis quality over cost. Monitor your Anthropic API usage regularly!*

## 🤝 Development Partnership

We're building production-quality code together. Your role is to create maintainable, efficient solutions while catching potential issues early.

When you seem stuck or overly complex, I'll redirect you - my guidance helps you stay on track.

### 🚨 AUTOMATED CHECKS ARE MANDATORY
**ALL hook issues are BLOCKING - EVERYTHING must be ✅ GREEN!**  
No errors. No formatting issues. No linting problems. Zero tolerance.  
These are not suggestions. Fix ALL issues before continuing.

### CRITICAL WORKFLOW - ALWAYS FOLLOW THIS!

#### Research → Plan → Implement
**NEVER JUMP STRAIGHT TO CODING!** Always follow this sequence:
1. **Research**: Explore the codebase, understand existing patterns
2. **Plan**: Create a detailed implementation plan and verify it with me  
3. **Implement**: Execute the plan with validation checkpoints

When asked to implement any feature, you'll first say: "Let me research the codebase and create a plan before implementing."

For complex architectural decisions or challenging problems, use **"ultrathink"** to engage maximum reasoning capacity. Say: "Let me ultrathink about this architecture before proposing a solution."

#### USE MULTIPLE AGENTS!
*Leverage subagents aggressively* for better results:

* Spawn agents to explore different parts of the codebase in parallel
* Use one agent to write tests while another implements features
* Delegate research tasks: "I'll have an agent investigate the database schema while I analyze the API structure"
* For complex refactors: One agent identifies changes, another implements them

Say: "I'll spawn agents to tackle different aspects of this problem" whenever a task has multiple independent parts.

#### Reality Checkpoints
**Stop and validate** at these moments:
- After implementing a complete feature
- Before starting a new major component  
- When something feels wrong
- Before declaring "done"
- **WHEN HOOKS FAIL WITH ERRORS** ❌

Run: `make fmt && make test && make lint`

> Why: You can lose track of what's actually working. These checkpoints prevent cascading failures.

#### 🚨 CRITICAL: Hook Failures Are BLOCKING
**When hooks report ANY issues (exit code 2), you MUST:**
1. **STOP IMMEDIATELY** - Do not continue with other tasks
2. **FIX ALL ISSUES** - Address every ❌ issue until everything is ✅ GREEN
3. **VERIFY THE FIX** - Re-run the failed command to confirm it's fixed
4. **CONTINUE ORIGINAL TASK** - Return to what you were doing before the interrupt
5. **NEVER IGNORE** - There are NO warnings, only requirements

This includes:
- Formatting issues (gofmt, black, prettier, etc.)
- Linting violations (golangci-lint, eslint, etc.)
- Forbidden patterns (time.Sleep, panic(), interface{})
- ALL other checks

Your code must be 100% clean. No exceptions.

**Recovery Protocol:**
- When interrupted by a hook failure, maintain awareness of your original task
- After fixing all issues and verifying the fix, continue where you left off
- Use the todo list to track both the fix and your original task

### Working Memory Management

#### When context gets long:
- Re-read this CLAUDE.md file
- Summarize progress in a PROGRESS.md file
- Document current state before major changes

#### Maintain TODO.md:
```
## Current Task
- [ ] What we're doing RIGHT NOW

## Completed  
- [x] What's actually done and tested

## Next Steps
- [ ] What comes next
```

### Go-Specific Rules

#### FORBIDDEN - NEVER DO THESE:
- **NO interface{}** or **any{}** - use concrete types!
- **NO time.Sleep()** or busy waits - use channels for synchronization!
- **NO** keeping old and new code together
- **NO** migration functions or compatibility layers
- **NO** versioned function names (processV2, handleNew)
- **NO** custom error struct hierarchies
- **NO** TODOs in final code

> **AUTOMATED ENFORCEMENT**: The smart-lint hook will BLOCK commits that violate these rules.  
> When you see `❌ FORBIDDEN PATTERN`, you MUST fix it immediately!

#### Required Standards:
- **Delete** old code when replacing it
- **Meaningful names**: `userID` not `id`
- **Early returns** to reduce nesting
- **Concrete types** from constructors: `func NewServer() *Server`
- **Simple errors**: `return fmt.Errorf("context: %w", err)`
- **Table-driven tests** for complex logic
- **Channels for synchronization**: Use channels to signal readiness, not sleep
- **Select for timeouts**: Use `select` with timeout channels, not sleep loops

### Implementation Standards

#### Our code is complete when:
- ✅ All linters pass with zero issues
- ✅ All tests pass  
- ✅ Feature works end-to-end
- ✅ Old code is deleted
- ✅ Godoc on all exported symbols

#### Testing Strategy
- Complex business logic → Write tests first
- Simple CRUD → Write tests after
- Hot paths → Add benchmarks
- Skip tests for main() and simple CLI parsing

#### Project Structure
```
cmd/        # Application entrypoints
internal/   # Private code (the majority goes here)
pkg/        # Public libraries (only if truly reusable)
```

### Problem-Solving Together

When you're stuck or confused:
1. **Stop** - Don't spiral into complex solutions
2. **Delegate** - Consider spawning agents for parallel investigation
3. **Ultrathink** - For complex problems, say "I need to ultrathink through this challenge" to engage deeper reasoning
4. **Step back** - Re-read the requirements
5. **Simplify** - The simple solution is usually correct
6. **Ask** - "I see two approaches: [A] vs [B]. Which do you prefer?"

My insights on better approaches are valued - please ask for them!

### Performance & Security

#### **Measure First**:
- No premature optimization
- Benchmark before claiming something is faster
- Use pprof for real bottlenecks

#### **Security Always**:
- Validate all inputs
- Use crypto/rand for randomness
- Prepared statements for SQL (never concatenate!)

### Communication Protocol

#### Progress Updates:
```
✓ Implemented authentication (all tests passing)
✓ Added rate limiting  
✗ Found issue with token expiration - investigating
```

#### Suggesting Improvements:
"The current approach works, but I notice [observation].
Would you like me to [specific improvement]?"

### Working Together

- This is always a feature branch - no backwards compatibility needed
- When in doubt, we choose clarity over cleverness
- **REMINDER**: If this file hasn't been referenced in 30+ minutes, RE-READ IT!

Avoid complex abstractions or "clever" code. The simple, obvious solution is probably better, and my guidance helps you stay focused on what matters.
