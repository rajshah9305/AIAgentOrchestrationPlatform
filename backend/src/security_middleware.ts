import { NextRequest, NextResponse } from 'next/server'

interface SecurityConfig {
  enableCSP: boolean
  enableHSTS: boolean
  enableCORS: boolean
  corsOrigins: string[]
  rateLimiting: boolean
}

const defaultSecurityConfig: SecurityConfig = {
  enableCSP: true,
  enableHSTS: true,
  enableCORS: true,
  corsOrigins: ['http://localhost:3000', 'https://agentorchestra.dev'],
  rateLimiting: true,
}

export function securityMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()
  
  // Set security headers
  setSecurityHeaders(response)
  
  // Set CORS headers
  setCORSHeaders(request, response)
  
  return response
}

function setSecurityHeaders(response: NextResponse): void {
  // Content Security Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src 'none'; object-src 'none';"
  )
  
  // HTTP Strict Transport Security
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  
  // X-Content-Type-Options
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // X-Frame-Options
  response.headers.set('X-Frame-Options', 'DENY')
  
  // X-XSS-Protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  )
}

function setCORSHeaders(request: NextRequest, response: NextResponse): void {
  const origin = request.headers.get('origin')
  
  if (origin && defaultSecurityConfig.corsOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
  }
  
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
}

function setCSPHeaders(response: NextResponse): void {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; ')
  
  response.headers.set('Content-Security-Policy', csp)
}

export class InputValidator {
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
  }
  
  static validateAgentName(name: string): boolean {
    if (!name || typeof name !== 'string') return false
    if (name.length < 1 || name.length > 100) return false
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) return false
    return true
  }
  
  static validateConfiguration(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!config || typeof config !== 'object') {
      errors.push('Configuration must be an object')
      return { valid: false, errors }
    }
    
    if (config.framework && !['autogen', 'crewai', 'autogpt', 'babyagi', 'langgraph'].includes(config.framework)) {
      errors.push('Invalid framework specified')
    }
    
    if (config.maxTokens && (typeof config.maxTokens !== 'number' || config.maxTokens < 1 || config.maxTokens > 10000)) {
      errors.push('maxTokens must be a number between 1 and 10000')
    }
    
    if (config.temperature && (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2)) {
      errors.push('temperature must be a number between 0 and 2')
    }
    
    return { valid: errors.length === 0, errors }
  }
  
  static validateWebhookUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }
  
  static sanitizeExecutionInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeString(input)
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeExecutionInput(item))
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeExecutionInput(value)
      }
      return sanitized
    }
    
    return input
  }
}

export class EncryptionService {
  private static readonly algorithm = 'aes-256-gcm'
  private static readonly keyLength = 32
  private static readonly ivLength = 16
  private static readonly tagLength = 16
  
  static generateKey(): string {
    return require('crypto').randomBytes(this.keyLength).toString('hex')
  }
  
  static encrypt(text: string, key: string): string {
    const crypto = require('crypto')
    const iv = crypto.randomBytes(this.ivLength)
    const cipher = crypto.createCipher(this.algorithm, Buffer.from(key, 'hex'))
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }
  
  static decrypt(encryptedData: string, key: string): string {
    const crypto = require('crypto')
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const decipher = crypto.createDecipher(this.algorithm, Buffer.from(key, 'hex'))
    
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
  
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const crypto = require('crypto')
    const generatedSalt = salt || crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha512').toString('hex')
    
    return { hash, salt: generatedSalt }
  }
  
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hashPassword(password, salt)
    return computedHash === hash
  }
}

export interface AuditEvent {
  userId: string
  action: string
  resourceType: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  details?: any
  risk?: 'low' | 'medium' | 'high'
}

export class AuditLogger {
  static async log(event: AuditEvent): Promise<void> {
    try {
      // In a real implementation, this would log to a database or external service
      console.log('AUDIT:', {
        timestamp: new Date().toISOString(),
        ...event
      })
      
      // Alert on high-risk activities
      if (event.risk === 'high') {
        await this.alertHighRiskActivity(event)
      }
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }
  
  static async getAuditTrail(
    userId?: string,
    resourceType?: string,
    startDate?: Date,
    endDate?: Date,
    limit = 100
  ): Promise<any[]> {
    // In a real implementation, this would query the audit database
    console.log('Getting audit trail for:', { userId, resourceType, startDate, endDate, limit })
    return []
  }
  
  private static async alertHighRiskActivity(event: AuditEvent): Promise<void> {
    // In a real implementation, this would send alerts via email, Slack, etc.
    console.warn('HIGH RISK ACTIVITY DETECTED:', event)
  }
  
  static async detectAnomalous(userId: string): Promise<boolean> {
    // In a real implementation, this would analyze user behavior patterns
    console.log('Checking for anomalous activity for user:', userId)
    return false
  }
}