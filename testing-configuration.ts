// backend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

// backend/src/test/setup.ts
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { prisma } from '../lib/database';
import { redis } from '../lib/redis';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.CEREBRAS_API_KEY = 'test-cerebras-key';

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
  
  // Connect to test Redis
  await redis.connect();
  
  // Run migrations
  await prisma.$executeRaw`CREATE SCHEMA IF NOT EXISTS public`;
});

afterAll(async () => {
  // Cleanup
  await prisma.$disconnect();
  await redis.disconnect();
});

beforeEach(async () => {
  // Clear database
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  if (tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  }

  // Clear Redis
  await redis.flushAll();
});

afterEach(() => {
  // Reset mocks
  vi.clearAllMocks();
});

// Global test utilities
export const createTestUser = async (overrides = {}) => {
  return prisma.user.create({
    data: {
      email: 'test@example.com',
      name: 'Test User',
      hashedPassword: 'hashed-password',
      ...overrides,
    },
  });
};

export const createTestAgent = async (userId: string, overrides = {}) => {
  return prisma.agent.create({
    data: {
      userId,
      name: 'Test Agent',
      framework: 'CEREBRAS',
      configuration: {
        system_message: 'You are a test assistant',
      },
      ...overrides,
    },
  });
};

// backend/src/api/agents/routes.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index';
import { createTestUser, createTestAgent } from '../../test/setup';
import jwt from 'jsonwebtoken';

describe('Agent Routes', () => {
  let user: any;
  let token: string;

  beforeEach(async () => {
    user = await createTestUser();
    token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!
    );
  });

  describe('GET /api/agents', () => {
    it('should return user agents', async () => {
      await createTestAgent(user.id, { name: 'Agent 1' });
      await createTestAgent(user.id, { name: 'Agent 2' });

      const response = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.agents).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter by framework', async () => {
      await createTestAgent(user.id, { framework: 'CEREBRAS' });
      await createTestAgent(user.id, { framework: 'AUTOGEN' });

      const response = await request(app)
        .get('/api/agents?framework=CEREBRAS')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.agents).toHaveLength(1);
      expect(response.body.agents[0].framework).toBe('CEREBRAS');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/agents')
        .expect(401);
    });
  });

  describe('POST /api/agents', () => {
    it('should create a new agent', async () => {
      const agentData = {
        name: 'New Agent',
        description: 'Test agent',
        framework: 'CEREBRAS',
        configuration: {
          system_message: 'You are a helpful assistant',
        },
      };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send(agentData)
        .expect(201);

      expect(response.body.name).toBe(agentData.name);
      expect(response.body.framework).toBe(agentData.framework);
    });

    it('should validate input', async () => {
      const invalidData = {
        name: '', // Empty name
        framework: 'INVALID', // Invalid framework
      };

      const response = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
    });
  });
});

// frontend/jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

// frontend/jest.setup.js
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
}));

// Mock next-auth
jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
    },
    status: 'authenticated',
  }),
  getSession: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3002';
process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3002';

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// frontend/components/ui/button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './button';

describe('Button Component', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant styles', () => {
    const { rerender } = render(<Button variant="default">Default</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');

    rerender(<Button variant="destructive">Destructive</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');
  });
});

// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});

// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should display sign in page', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await expect(page).toHaveTitle(/Sign In/);
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should sign in with credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('.error-message')).toBeVisible();
  });
});