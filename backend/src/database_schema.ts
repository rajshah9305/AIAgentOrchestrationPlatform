// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  role          UserRole  @default(USER)
  subscription  String?   @default("free")
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastLoginAt   DateTime?

  // Relations
  agents        Agent[]
  executions    Execution[]
  configurations SavedConfiguration[]
  auditLogs     AuditLog[]
  apiKeys       ApiKey[]

  @@map("users")
}

model Agent {
  id            String      @id @default(cuid())
  name          String
  description   String?
  framework     Framework
  configuration Json        @default("{}")
  tags          String[]    @default([])
  status        AgentStatus @default(IDLE)
  isActive      Boolean     @default(true)
  
  // Performance metrics
  totalExecutions     Int @default(0)
  successfulExecutions Int @default(0)
  avgExecutionTime    Float?
  lastExecutedAt      DateTime?
  
  // Resource usage
  cpuUsage      Float?
  memoryUsage   Float?
  
  // Timestamps
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  
  // Relations
  userId        String
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  executions    Execution[]
  
  @@map("agents")
  @@index([userId, framework])
  @@index([status])
}

model Execution {
  id            String          @id @default(cuid())
  status        ExecutionStatus @default(PENDING)
  input         Json?
  output        Json?
  error         String?
  duration      Int?            // in milliseconds
  tokensUsed    Int?
  cost          Float?
  
  // Execution context
  trigger       String?         // manual, scheduled, webhook
  environment   String?         // development, staging, production
  version       String?         // agent version
  
  // Timestamps
  startedAt     DateTime        @default(now())
  completedAt   DateTime?
  
  // Relations
  agentId       String
  agent         Agent           @relation(fields: [agentId], references: [id], onDelete: Cascade)
  userId        String
  user          User            @relation(fields: [userId], references: [id])
  logs          ExecutionLog[]
  
  @@map("executions")
  @@index([agentId, startedAt])
  @@index([userId, startedAt])
  @@index([status])
}

model ExecutionLog {
  id            String    @id @default(cuid())
  level         LogLevel  @default(INFO)
  message       String
  timestamp     DateTime  @default(now())
  metadata      Json?
  
  // Relations
  executionId   String
  execution     Execution @relation(fields: [executionId], references: [id], onDelete: Cascade)
  
  @@map("execution_logs")
  @@index([executionId, timestamp])
}

model SavedConfiguration {
  id            String    @id @default(cuid())
  name          String
  description   String?
  framework     Framework
  configuration Json
  isTemplate    Boolean   @default(false)
  isPublic      Boolean   @default(false)
  
  // Usage tracking
  usageCount    Int       @default(0)
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("saved_configurations")
  @@index([userId, framework])
  @@index([isTemplate])
}

model AuditLog {
  id            String      @id @default(cuid())
  action        AuditAction
  resourceType  String
  resourceId    String?
  details       Json?
  ipAddress     String?
  userAgent     String?
  
  // Timestamps
  createdAt     DateTime    @default(now())
  
  // Relations
  userId        String
  user          User        @relation(fields: [userId], references: [id])
  
  @@map("audit_logs")
  @@index([userId, createdAt])
  @@index([resourceType, resourceId])
}

model ApiKey {
  id            String    @id @default(cuid())
  name          String
  key           String    @unique
  lastUsedAt    DateTime?
  usageCount    Int       @default(0)
  isActive      Boolean   @default(true)
  expiresAt     DateTime?
  
  // Permissions
  permissions   String[]  @default([])
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("api_keys")
  @@index([userId])
  @@index([key])
}

model Framework {
  id            String    @id @default(cuid())
  name          String    @unique
  displayName   String
  description   String?
  category      String    // single-agent, multi-agent
  difficulty    String    // beginner, intermediate, advanced
  rating        Float     @default(0)
  growth        Float     @default(0)    // percentage growth
  logoUrl       String?
  documentationUrl String?
  githubUrl     String?
  
  // Features
  features      String[]  @default([])
  tags          String[]  @default([])
  
  // Configuration schema
  configSchema  Json?
  defaultConfig Json?
  
  // Status
  isActive      Boolean   @default(true)
  isPopular     Boolean   @default(false)
  isNew         Boolean   @default(false)
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  @@map("frameworks")
}

// Enums
enum UserRole {
  USER
  ADMIN
  ENTERPRISE
}

enum Framework {
  AUTOGEN
  METAGPT
  CREWAI
  AUTOGPT
  BABYAGI
  LANGGRAPH
  CAMELAI
  AGENTVERSE
  OPENAGENTS
  MINIAGI
  ORCA
  CEREBRAS
  CEREBRAS_AUTOGEN
}

enum AgentStatus {
  IDLE
  RUNNING
  PAUSED
  ERROR
  DEPLOYING
  STOPPED
}

enum ExecutionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
  TIMEOUT
}

enum LogLevel {
  DEBUG
  INFO
  WARN
  ERROR
  FATAL
}

enum AuditAction {
  AGENT_CREATED
  AGENT_UPDATED
  AGENT_DELETED
  AGENT_STARTED
  AGENT_STOPPED
  EXECUTION_STARTED
  EXECUTION_COMPLETED
  CONFIG_SAVED
  CONFIG_DELETED
  USER_LOGIN
  USER_LOGOUT
  API_KEY_CREATED
  API_KEY_REVOKED
}