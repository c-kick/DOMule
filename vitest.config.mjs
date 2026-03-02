import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Use jsdom for DOM simulation
        environment: 'jsdom',

        // Test file patterns
        include: ['__tests__/**/*.test.mjs'],

        // Global test setup
        setupFiles: ['__tests__/setup.mjs'],

        // Coverage configuration
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['core.*.mjs', 'util.*.mjs'],
            exclude: ['**/*.test.mjs', '**/*.d.ts', 'modules/**'],
            thresholds: {
                // Enforce minimum coverage
                lines: 70,
                functions: 70,
                branches: 60,
                statements: 70
            }
        },

        // Timeout for async tests
        testTimeout: 10000,

        // Run tests in sequence (some tests may share state)
        sequence: {
            shuffle: false
        }
    }
});
