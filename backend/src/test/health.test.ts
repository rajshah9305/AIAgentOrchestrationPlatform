import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../index'

describe('Health Check', () => {
  it('should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body).toHaveProperty('status')
    expect(response.body).toHaveProperty('timestamp')
    expect(response.body).toHaveProperty('version')
    expect(response.body).toHaveProperty('uptime')
    expect(response.body).toHaveProperty('checks')
    expect(response.body).toHaveProperty('responseTime')
  })

  it('should include database check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body.checks).toHaveProperty('database')
    expect(response.body.checks.database).toHaveProperty('status')
    expect(response.body.checks.database).toHaveProperty('responseTime')
  })

  it('should include Redis check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body.checks).toHaveProperty('redis')
    expect(response.body.checks.redis).toHaveProperty('status')
    expect(response.body.checks.redis).toHaveProperty('responseTime')
  })

  it('should include system check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200)

    expect(response.body.checks).toHaveProperty('system')
    expect(response.body.checks.system).toHaveProperty('status')
    expect(response.body.checks.system).toHaveProperty('responseTime')
  })
}) 