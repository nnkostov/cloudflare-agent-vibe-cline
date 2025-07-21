-- Tier Assignment Repair Script
-- Generated: 2025-07-19T00:47:00.613Z
-- Updates: 23 repositories

BEGIN TRANSACTION;

-- Update x1xhlol/system-prompts-and-models-of-ai-tools (69116 stars)
UPDATE repo_tiers 
SET tier = 1,
    stars = 69116,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '943398999';

-- Update Significant-Gravitas/AutoGPT (177014 stars)
UPDATE repo_tiers 
SET tier = 1,
    stars = 177014,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '614765452';

-- Update microsoft/generative-ai-for-beginners (91983 stars)
UPDATE repo_tiers 
SET tier = 1,
    stars = 91983,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '655806940';

-- Update x1xhlol/system-prompts-and-models-of-ai-tools (69116 stars)
UPDATE repo_tiers 
SET tier = 1,
    stars = 69116,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '943398999';

-- Update lobehub/lobe-chat (63582 stars)
UPDATE repo_tiers 
SET tier = 2,
    stars = 63582,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '643445235';

-- Update kortix-ai/suna (16804 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 16804,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '868173144';

-- Update elizaOS/eliza (16436 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 16436,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '826170402';

-- Update bytedance/deer-flow (15383 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 15383,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '979115477';

-- Update mastra-ai/mastra (15102 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 15102,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '839037098';

-- Update NirDiamant/GenAI_Agents (14742 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 14742,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '854807707';

-- Update patchy631/ai-engineering-hub (14307 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 14307,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '876064934';

-- Update carla-simulator/carla (12744 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 12744,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '108102826';

-- Update openai/openai-agents-python (12714 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 12714,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '946380199';

-- Update google/adk-python (11045 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 11045,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '958830659';

-- Update coderamp-labs/gitingest (11012 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 11012,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '895942941';

-- Update web-infra-dev/midscene (9671 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 9671,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '832452447';

-- Update humanlayer/12-factor-agents (9471 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 9471,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '957658915';

-- Update GLips/Figma-Context-MCP (9221 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 9221,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '931892749';

-- Update Mail-0/Zero (8930 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 8930,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '926252103';

-- Update openvinotoolkit/openvino (8601 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 8601,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '153097643';

-- Update AsyncFuncAI/deepwiki-open (8390 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 8390,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '975318071';

-- Update elder-plinius/CL4R1T4S (8079 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 8079,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '942867788';

-- Update asgeirtj/system_prompts_leaks (7719 stars)
UPDATE repo_tiers 
SET tier = 3,
    stars = 7719,
    updated_at = CURRENT_TIMESTAMP
WHERE repo_id = '976921297';

COMMIT;

-- Verify the new distribution
SELECT tier, COUNT(*) as count, 
       ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM repo_tiers), 1) as percentage
FROM repo_tiers 
GROUP BY tier 
ORDER BY tier;
