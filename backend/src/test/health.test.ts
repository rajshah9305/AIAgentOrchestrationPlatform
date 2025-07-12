import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { app } from '../index'

describe('Health Check Endpoint', () => {
  it('should return healthy status', async () => {
    const response = await request(app).get('/health')
    
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      status: 'healthy',
      timestamp: expect.any(String),
      uptime: expect.any(Number),
      environment: 'test',
    })
  })

  it('should have correct content type', async () => {
    const response = await request(app).get('/health')
    
    expect(response.headers['content-type']).toContain('application/json')
  })
})

describe('API Information Endpoint', () => {
  it('should return API information', async () => {
    const response = await request(app).get('/api')
    
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      message: 'AI Agent Orchestrator API',
      version: '1.0.0',
      status: 'running',
      features: {
        cerebras: 'enabled',
        streaming: 'enabled',
        websockets: 'enabled',
        webhooks: 'enabled',
      },
    })
  })
}) 