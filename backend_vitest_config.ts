// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Global setup and teardown
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    
    // Test file patterns
    include: [
      'src/**/*.{test,spec}.{js,ts}',
      'src/**/__tests__/**/*.{js,ts}'
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
      'src/test/fixtures/**'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: [
        'src/**/*.{js,ts}',
      ],
      exclude: [
        'src/**/*.{test,spec}.{js,ts}',
        'src/**/__tests__/**',
        'src/test/**',
        'src/types/**',
        'src/**/*.d.ts',
        'dist/**',
        'node_modules/**',
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    
    // Test timeout
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Concurrency
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: 4,
      },
    },
    
    // Test isolation
    isolate: true,
    
    // Watch mode
    watch: false,
    
    // Reporter configuration
    reporter: process.env.CI ? ['verbose', 'github-actions'] : ['verbose'],
    
    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    
    // Snapshot configuration
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath.replace(/\.test\.([tj]s?)/, `${snapExtension}.$1`)
    },
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/api': resolve(__dirname, './src/api'),
      '@/lib': resolve(__dirname, './src/lib'),
      '@/middleware': resolve(__dirname, './src/middleware'),
      '@/services': resolve(__dirname, './src/services'),
      '@/types': resolve(__dirname, './src/types'),
      '@/utils': resolve(__dirname, './src/utils'),
    },
  },
  
  // Define configuration
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  
  // ESBuild configuration
  esbuild: {
    target: 'node18',
  },
})