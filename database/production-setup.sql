-- GitHub AI Intelligence Agent Database Schema

-- Drop existing tables if they exist
DROP TABLE IF EXISTS trends;
DROP TABLE IF EXISTS contributors;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS analyses;
DROP TABLE IF EXISTS repo_metrics;
DROP TABLE IF EXISTS repositories;

-- Repositories table
CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  full_name TEXT NOT NULL,
  description TEXT,
  stars INTEGER NOT NULL DEFAULT 0,
  forks INTEGER NOT NULL DEFAULT 0,
  open_issues INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  topics TEXT, -- JSON array
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  pushed_at TEXT NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0,
  is_fork INTEGER NOT NULL DEFAULT 0,
  html_url TEXT,
  clone_url TEXT,
  default_branch TEXT,
  discovered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Repository metrics history
CREATE TABLE repo_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  stars INTEGER NOT NULL,
  forks INTEGER NOT NULL,
  open_issues INTEGER NOT NULL,
  watchers INTEGER NOT NULL DEFAULT 0,
  contributors INTEGER NOT NULL DEFAULT 0,
  commits_count INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Simplified analyses table
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  investment_score INTEGER NOT NULL,
  innovation_score INTEGER NOT NULL,
  team_score INTEGER NOT NULL,
  market_score INTEGER NOT NULL,
  recommendation TEXT NOT NULL,
  summary TEXT NOT NULL,
  strengths TEXT NOT NULL, -- JSON array
  risks TEXT NOT NULL, -- JSON array
  questions TEXT NOT NULL, -- JSON array
  model TEXT NOT NULL,
  cost REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Alerts table
CREATE TABLE alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT, -- JSON object
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_at TEXT,
  FOREIGN KEY (repo_id) REFERENCES repositories(id)
);

-- Contributors table
CREATE TABLE contributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo_id TEXT NOT NULL,
  username TEXT NOT NULL,
  contributions INTEGER NOT NULL,
  profile_url TEXT,
  company TEXT,
  location TEXT,
  bio TEXT,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  public_repos INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repositories(id),
  UNIQUE(repo_id, username)
);

-- Trends table
CREATE TABLE trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  growth_rate REAL NOT NULL,
  repo_count INTEGER NOT NULL,
  total_stars INTEGER NOT NULL,
  examples TEXT NOT NULL, -- JSON array of repo IDs
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(type, name)
);

-- Indexes for performance
CREATE INDEX idx_repos_stars ON repositories(stars DESC);
CREATE INDEX idx_repos_updated ON repositories(updated_at DESC);
CREATE INDEX idx_repos_language ON repositories(language);
CREATE INDEX idx_metrics_repo_time ON repo_metrics(repo_id, recorded_at DESC);
CREATE INDEX idx_analyses_repo ON analyses(repo_id, created_at DESC);
CREATE INDEX idx_alerts_sent ON alerts(sent_at DESC);
CREATE INDEX idx_trends_growth ON trends(growth_rate DESC);

-- Insert sample data
INSERT INTO repositories (id, name, owner, full_name, description, stars, forks, open_issues, language, topics, created_at, updated_at, pushed_at, is_archived, is_fork, html_url, clone_url, default_branch, discovered_at) VALUES
('552661142', 'langchain', 'langchain-ai', 'langchain-ai/langchain', '🦜🔗 Build context-aware reasoning applications', 111516, 18151, 315, 'Jupyter Notebook', '[]', '2022-10-17T02:58:36Z', '2025-07-15T20:36:05Z', '2025-07-15T20:23:31Z', 0, 0, 'https://github.com/langchain-ai/langchain', 'https://github.com/langchain-ai/langchain.git', 'master', '2025-07-15 20:39:56'),
('614765452', 'AutoGPT', 'Significant-Gravitas', 'Significant-Gravitas/AutoGPT', 'AutoGPT is the vision of accessible AI for everyone, to use and to build on. Our mission is to provide the tools, so that you can focus on what matters.', 176953, 45872, 209, 'Python', '["ai","artificial-intelligence","autonomous-agents","gpt-4","llama-api","openai","python"]', '2023-03-16T09:21:07Z', '2025-07-15T23:59:08Z', '2025-07-15T23:24:12Z', 0, 0, 'https://github.com/Significant-Gravitas/AutoGPT', 'https://github.com/Significant-Gravitas/AutoGPT.git', 'master', '2025-07-16 00:06:30'),
('527591471', 'stable-diffusion-webui', 'AUTOMATIC1111', 'AUTOMATIC1111/stable-diffusion-webui', 'Stable Diffusion web UI', 154534, 28689, 2417, 'Python', '["ai","ai-art","deep-learning","diffusion","gradio","image-generation","image2image","img2img","pytorch","stable-diffusion","text2image","torch","txt2img","unstable","upscaling","web"]', '2022-08-22T14:05:26Z', '2025-07-15T23:34:02Z', '2025-05-03T06:17:03Z', 0, 0, 'https://github.com/AUTOMATIC1111/stable-diffusion-webui', 'https://github.com/AUTOMATIC1111/stable-diffusion-webui.git', 'master', '2025-07-16 00:06:30'),
('193215554', 'n8n', 'n8n-io', 'n8n-io/n8n', 'Fair-code workflow automation platform with native AI capabilities. Combine visual building with custom code, self-host or cloud, 400+ integrations.', 118489, 35674, 990, 'TypeScript', '["ai","apis","automation","cli","data-flow","development","integration-framework","integrations","ipaas","low-code","low-code-platform","mcp","mcp-client","mcp-server","n8n","no-code","self-hosted","typescript","workflow","workflow-automation"]', '2019-06-22T09:24:21Z', '2025-07-15T23:57:42Z', '2025-07-15T21:08:53Z', 0, 0, 'https://github.com/n8n-io/n8n', 'https://github.com/n8n-io/n8n.git', 'master', '2025-07-16 00:06:30'),
('626805178', 'dify', 'langgenius', 'langgenius/dify', 'Production-ready platform for agentic workflow development.', 107090, 16242, 758, 'TypeScript', '["agent","agentic-ai","agentic-framework","agentic-workflow","ai","automation","gemini","genai","gpt","gpt-4","llm","low-code","mcp","nextjs","no-code","openai","orchestration","python","rag","workflow"]', '2023-04-12T07:40:24Z', '2025-07-15T22:57:49Z', '2025-07-15T18:02:42Z', 0, 0, 'https://github.com/langgenius/dify', 'https://github.com/langgenius/dify.git', 'main', '2025-07-16 00:06:30');

-- Insert sample analyses
INSERT INTO analyses (repo_id, investment_score, innovation_score, team_score, market_score, recommendation, summary, strengths, risks, questions, model, cost, created_at) VALUES
('552661142', 90, 95, 85, 92, 'strong-buy', 'LangChain is a highly innovative and promising open-source framework for building applications powered by large language models (LLMs). It simplifies the development process by providing a standardized interface for integrating various components such as models, embeddings, vector stores, and third-party integrations. The project has garnered significant traction, with over 111,000 stars on GitHub and a rapidly growing community.

The framework''s modular design and emphasis on interoperability and future-proofing make it well-positioned to capitalize on the rapidly evolving LLM landscape. Its ecosystem, which includes products like LangSmith for observability, LangGraph for agent orchestration, and the LangGraph Platform for deployment and scaling, provides a comprehensive suite of tools for building and managing LLM applications.

The project''s active development, with frequent updates and a large contributor base, demonstrates a strong and dedicated team. Additionally, the market opportunity for LLM-powered applications is vast and rapidly growing, as businesses across various industries seek to leverage the capabilities of these models.', '["Highly innovative and modular framework for building LLM-powered applications","Emphasis on interoperability and future-proofing, allowing for easy adaptation as the LLM landscape evolves","Comprehensive ecosystem with complementary products for observability, agent orchestration, and deployment/scaling","Significant traction and a rapidly growing community, with over 111,000 stars on GitHub","Active development and frequent updates, demonstrating a strong and dedicated team"]', '["Competition from other LLM frameworks and platforms, both open-source and proprietary","Potential challenges in maintaining compatibility and keeping up with the rapid pace of innovation in the LLM space","Reliance on the continued development and adoption of LLMs, which may face regulatory or ethical concerns","Potential scalability and performance issues as the framework is adopted more widely"]', '["How does the team plan to maintain compatibility and keep up with the rapid pace of innovation in the LLM space?","What is the long-term roadmap and vision for the project, and how does the team plan to sustain its development efforts?","How does the team plan to address potential scalability and performance issues as the framework is adopted more widely?","What measures are in place to ensure the responsible and ethical use of LLMs within the framework?","How does the team plan to differentiate LangChain from competing LLM frameworks and platforms, both open-source and proprietary?"]', 'claude-3-sonnet-20240229', 0.0021855, '2025-07-15 02:00:01');

-- Insert sample alerts
INSERT INTO alerts (repo_id, type, level, message, metadata, sent_at) VALUES
('552661142', 'high_growth', 'info', 'Repository langchain-ai/langchain has shown exceptional growth with 111516 stars', '{"growth_rate": 15.2, "previous_stars": 96800}', '2025-07-15 20:40:00'),
('614765452', 'trending', 'info', 'Repository Significant-Gravitas/AutoGPT is trending in AI category', '{"category": "AI", "rank": 1}', '2025-07-16 00:06:35');

-- Insert sample trends
INSERT INTO trends (type, name, description, growth_rate, repo_count, total_stars, examples, detected_at, last_updated) VALUES
('technology', 'AI/ML Frameworks', 'Frameworks and tools for building AI/ML applications', 25.5, 15, 850000, '["552661142","614765452","626805178"]', '2025-07-15 00:00:00', '2025-07-16 00:00:00'),
('topic', 'Model Context Protocol (MCP)', 'Tools and frameworks supporting the Model Context Protocol', 45.2, 8, 320000, '["193215554","626805178"]', '2025-07-15 00:00:00', '2025-07-16 00:00:00');
