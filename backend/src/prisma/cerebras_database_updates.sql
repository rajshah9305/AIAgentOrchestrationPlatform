-- Cerebras Integration Database Updates
-- This file contains SQL updates for Cerebras integration

-- Add Cerebras-specific columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS cerebras_model VARCHAR(100);
ALTER TABLE agents ADD COLUMN IF NOT EXISTS cerebras_config JSONB;

-- Add Cerebras-specific columns to executions table
ALTER TABLE executions ADD COLUMN IF NOT EXISTS cerebras_usage JSONB;
ALTER TABLE executions ADD COLUMN IF NOT EXISTS cerebras_model VARCHAR(100);

-- Create index for Cerebras model lookups
CREATE INDEX IF NOT EXISTS idx_agents_cerebras_model ON agents(cerebras_model);
CREATE INDEX IF NOT EXISTS idx_executions_cerebras_model ON executions(cerebras_model);

-- Add Cerebras framework to frameworks table if not exists
INSERT INTO frameworks (id, name, display_name, description, category, difficulty, rating, growth, features, tags, is_popular, config_schema, created_at, updated_at)
VALUES (
  'cerebras-framework',
  'CEREBRAS',
  'Cerebras Ultra-Fast AI',
  'Ultra-fast AI inference with Cerebras models',
  'single-agent',
  'beginner',
  4.8,
  25,
  ARRAY['Ultra-fast inference', 'Real-time streaming', 'Cost-effective', 'Multiple models'],
  ARRAY['ultra-fast', 'cerebras', 'inference'],
  true,
  '{
    "type": "object",
    "properties": {
      "model": {
        "type": "string",
        "enum": ["llama-4-scout-17b-16e-instruct", "llama-3.1-70b-instruct", "llama-3.1-8b-instruct", "mixtral-8x7b-instruct", "gemma-7b-it"],
        "default": "llama-4-scout-17b-16e-instruct"
      },
      "temperature": {
        "type": "number",
        "minimum": 0,
        "maximum": 2,
        "default": 0.2
      },
      "max_tokens": {
        "type": "integer",
        "minimum": 1,
        "maximum": 8192,
        "default": 2048
      },
      "top_p": {
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "default": 1
      },
      "stream": {
        "type": "boolean",
        "default": true
      }
    },
    "required": ["model"]
  }',
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Add Cerebras AutoGen framework
INSERT INTO frameworks (id, name, display_name, description, category, difficulty, rating, growth, features, tags, is_popular, config_schema, created_at, updated_at)
VALUES (
  'cerebras-autogen-framework',
  'CEREBRAS_AUTOGEN',
  'Cerebras Multi-Agent',
  'Multi-agent conversations powered by Cerebras ultra-fast inference',
  'multi-agent',
  'intermediate',
  4.9,
  30,
  ARRAY['Multi-agent conversations', 'Ultra-fast inference', 'Real-time streaming', 'Cost-effective'],
  ARRAY['multi-agent', 'cerebras', 'conversation', 'ultra-fast'],
  true,
  '{
    "type": "object",
    "properties": {
      "model": {
        "type": "string",
        "enum": ["llama-4-scout-17b-16e-instruct", "llama-3.1-70b-instruct", "llama-3.1-8b-instruct"],
        "default": "llama-4-scout-17b-16e-instruct"
      },
      "agents": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "role": {"type": "string"},
            "system_message": {"type": "string"}
          },
          "required": ["name", "role", "system_message"]
        },
        "minItems": 1
      },
      "max_rounds": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "default": 5
      },
      "temperature": {
        "type": "number",
        "minimum": 0,
        "maximum": 2,
        "default": 0.2
      }
    },
    "required": ["model", "agents"]
  }',
  NOW(),
  NOW()
) ON CONFLICT (name) DO NOTHING;

-- Create view for Cerebras usage analytics
CREATE OR REPLACE VIEW cerebras_usage_analytics AS
SELECT 
  DATE_TRUNC('day', e.created_at) as date,
  COUNT(*) as total_executions,
  COUNT(CASE WHEN e.status = 'COMPLETED' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN e.status = 'FAILED' THEN 1 END) as failed_executions,
  AVG(e.duration) as avg_duration,
  SUM(e.tokens_used) as total_tokens,
  SUM(e.cost) as total_cost,
  a.cerebras_model,
  u.id as user_id
FROM executions e
JOIN agents a ON e.agent_id = a.id
JOIN users u ON e.user_id = u.id
WHERE a.framework IN ('CEREBRAS', 'CEREBRAS_AUTOGEN')
GROUP BY DATE_TRUNC('day', e.created_at), a.cerebras_model, u.id
ORDER BY date DESC;

-- Create function to calculate Cerebras cost
CREATE OR REPLACE FUNCTION calculate_cerebras_cost(tokens_used INTEGER)
RETURNS DECIMAL AS $$
BEGIN
  -- Cerebras pricing: $0.60 per 1M tokens
  RETURN (tokens_used::DECIMAL / 1000000) * 0.60;
END;
$$ LANGUAGE plpgsql;

-- Create function to update agent metrics
CREATE OR REPLACE FUNCTION update_agent_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'COMPLETED' THEN
    UPDATE agents 
    SET 
      total_executions = total_executions + 1,
      successful_executions = successful_executions + 1,
      avg_execution_time = CASE 
        WHEN avg_execution_time IS NULL THEN NEW.duration
        ELSE (avg_execution_time + NEW.duration) / 2
      END,
      last_executed_at = NEW.completed_at
    WHERE id = NEW.agent_id;
  ELSIF NEW.status = 'FAILED' THEN
    UPDATE agents 
    SET 
      total_executions = total_executions + 1,
      last_executed_at = NEW.completed_at
    WHERE id = NEW.agent_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update agent metrics
DROP TRIGGER IF EXISTS trigger_update_agent_metrics ON executions;
CREATE TRIGGER trigger_update_agent_metrics
  AFTER UPDATE ON executions
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_metrics();