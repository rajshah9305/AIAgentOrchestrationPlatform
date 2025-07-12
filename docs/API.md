# API Documentation

## Overview

The AI Agent Orchestrator API provides endpoints for managing AI agents, executing tasks, and integrating with Cerebras ultra-fast inference.

## Base URL

- **Development:** `http://localhost:3002`
- **Production:** `https://your-domain.com`

## Authentication

All API requests require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Health Check

#### GET /health

Check the health status of the API.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development"
}
```

### API Information

#### GET /api

Get general API information.

**Response:**
```json
{
  "message": "AI Agent Orchestrator API",
  "version": "1.0.0",
  "status": "running",
  "features": {
    "cerebras": "enabled",
    "streaming": "enabled",
    "websockets": "enabled",
    "webhooks": "enabled"
  }
}
```

### Cerebras Integration

#### GET /api/cerebras/models

Get available Cerebras models.

**Response:**
```json
{
  "models": [
    "llama-4-scout-17b-16e-instruct",
    "llama-3.1-8b-instruct",
    "llama-3.1-70b-instruct",
    "mixtral-8x7b-instruct",
    "gemma-7b-it"
  ],
  "default": "llama-4-scout-17b-16e-instruct",
  "features": {
    "streaming": true,
    "ultra_fast": true,
    "cost_effective": true
  }
}
```

#### POST /api/cerebras/test

Test Cerebras connection.

**Request Body:**
```json
{
  "model": "llama-4-scout-17b-16e-instruct"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cerebras connection successful!",
  "response": "Hello! Cerebras connection successful!",
  "model": "llama-4-scout-17b-16e-instruct",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### Agent Management

#### POST /api/agents/:id/execute

Execute an agent.

**Parameters:**
- `id` (string): Agent ID

**Request Body:**
```json
{
  "input": {
    "message": "Hello, how are you?"
  },
  "configuration": {
    "model": "llama-4-scout-17b-16e-instruct",
    "temperature": 0.2,
    "max_tokens": 2048
  }
}
```

**Response:**
```json
{
  "executionId": "exec_1234567890_abc123",
  "status": "queued",
  "message": "Execution started"
}
```

#### POST /api/agents/:id/execute/stream

Execute an agent with streaming response.

**Parameters:**
- `id` (string): Agent ID

**Request Body:**
```json
{
  "input": {
    "message": "Tell me a story"
  },
  "configuration": {
    "model": "llama-4-scout-17b-16e-instruct",
    "temperature": 0.7,
    "max_tokens": 1024,
    "stream": true
  }
}
```

**Response (Server-Sent Events):**
```
data: {"content": "Once", "type": "chunk"}

data: {"content": " upon", "type": "chunk"}

data: {"content": " a", "type": "chunk"}

data: {"content": " time", "type": "chunk"}

data: {"type": "done"}
```

### Webhook Management

#### POST /api/webhooks

Register a webhook.

**Request Body:**
```json
{
  "url": "https://your-domain.com/webhook",
  "events": ["execution_started", "execution_completed"]
}
```

**Response:**
```json
{
  "webhookId": "webhook_1234567890",
  "url": "https://your-domain.com/webhook",
  "events": ["execution_started", "execution_completed"],
  "status": "registered"
}
```

## WebSocket Events

Connect to WebSocket at `ws://localhost:3002` for real-time updates.

### Event Types

#### execution_started
```json
{
  "executionId": "exec_1234567890_abc123",
  "agentId": "agent_123",
  "userId": "user_456",
  "status": "queued"
}
```

#### execution_progress
```json
{
  "executionId": "exec_1234567890_abc123",
  "progress": 50,
  "message": "Processing request..."
}
```

#### execution_completed
```json
{
  "executionId": "exec_1234567890_abc123",
  "status": "completed",
  "result": {
    "response": "Hello! How can I help you?",
    "tokens_used": 15,
    "cost": 0.000009
  }
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

### Common Error Codes

- `401` - Unauthorized (invalid or missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Rate Limiting

- **Window:** 15 minutes
- **Limit:** 100 requests per IP
- **Headers:**
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## CORS

The API supports CORS for cross-origin requests:

- **Allowed Origins:** Configured via `CORS_ORIGIN` environment variable
- **Methods:** GET, POST, PUT, DELETE, OPTIONS
- **Headers:** Content-Type, Authorization

## Examples

### JavaScript/Node.js

```javascript
const response = await fetch('http://localhost:3002/api/cerebras/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer your-jwt-token'
  },
  body: JSON.stringify({
    model: 'llama-4-scout-17b-16e-instruct'
  })
});

const data = await response.json();
console.log(data);
```

### Python

```python
import requests

response = requests.post(
    'http://localhost:3002/api/cerebras/test',
    headers={
        'Content-Type': 'application/json',
        'Authorization': 'Bearer your-jwt-token'
    },
    json={
        'model': 'llama-4-scout-17b-16e-instruct'
    }
)

data = response.json()
print(data)
```

### cURL

```bash
curl -X POST http://localhost:3002/api/cerebras/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token" \
  -d '{"model": "llama-4-scout-17b-16e-instruct"}'
``` 