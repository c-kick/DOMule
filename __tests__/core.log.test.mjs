/**
 * @fileoverview Tests for core.log.mjs
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the logger behavior with mocked debug state
describe('core.log', () => {
    let originalLocation;
    let consoleSpies;

    beforeEach(() => {
        // Store original location
        originalLocation = window.location;

        // Set up console spies
        consoleSpies = {
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            info: vi.spyOn(console, 'info').mockImplementation(() => {}),
            warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {})
        };
    });

    afterEach(() => {
        // Restore all spies
        vi.restoreAllMocks();

        // Clear module cache to allow re-import with different debug state
        vi.resetModules();
    });

    describe('NAME', () => {
        it('exports module name', async () => {
            const { NAME } = await import('../core.log.mjs');
            expect(NAME).toBe('core.log');
        });
    });

    describe('DEBUG flag', () => {
        it('parses debug=true from URL', async () => {
            // Mock URL with debug=true
            delete window.location;
            window.location = { search: '?debug=true' };

            vi.resetModules();
            const { DEBUG } = await import('../core.log.mjs');

            expect(DEBUG).toBe(true);

            window.location = originalLocation;
        });

        it('returns false when debug not in URL', async () => {
            delete window.location;
            window.location = { search: '' };

            vi.resetModules();
            const { DEBUG } = await import('../core.log.mjs');

            expect(DEBUG).toBe(false);

            window.location = originalLocation;
        });

        it('returns false for debug=false', async () => {
            delete window.location;
            window.location = { search: '?debug=false' };

            vi.resetModules();
            const { DEBUG } = await import('../core.log.mjs');

            expect(DEBUG).toBe(false);

            window.location = originalLocation;
        });
    });

    describe('logger methods', () => {
        // Import logger with debug enabled
        async function getDebugLogger() {
            delete window.location;
            window.location = { search: '?debug=true' };
            vi.resetModules();
            const module = await import('../core.log.mjs');
            window.location = originalLocation;
            return module.logger;
        }

        // Import logger with debug disabled
        async function getProductionLogger() {
            delete window.location;
            window.location = { search: '' };
            vi.resetModules();
            const module = await import('../core.log.mjs');
            window.location = originalLocation;
            return module.logger;
        }

        describe('when DEBUG is true', () => {
            it('logger.log calls console.log', async () => {
                const logger = await getDebugLogger();

                logger.log('testModule', 'Test message');

                expect(consoleSpies.log).toHaveBeenCalled();
            });

            it('logger.info calls console.info', async () => {
                const logger = await getDebugLogger();

                logger.info('testModule', 'Info message');

                expect(consoleSpies.info).toHaveBeenCalled();
            });

            it('logger.warn calls console.warn', async () => {
                const logger = await getDebugLogger();

                logger.warn('testModule', 'Warning message');

                expect(consoleSpies.warn).toHaveBeenCalled();
            });

            it('logger.error calls console.error', async () => {
                const logger = await getDebugLogger();

                logger.error('testModule', 'Error message');

                expect(consoleSpies.error).toHaveBeenCalled();
            });

            it('formats core.* modules with two badges', async () => {
                const logger = await getDebugLogger();

                logger.info('core.scanner', 'Scan complete');

                // Should call with %c formatting for two badges
                const call = consoleSpies.info.mock.calls[0];
                expect(call[0]).toContain('%c');
                expect(call[0]).toContain('core');
                expect(call[0]).toContain('scanner');
            });

            it('formats regular modules with single badge', async () => {
                const logger = await getDebugLogger();

                logger.info('myModule', 'Message');

                const call = consoleSpies.info.mock.calls[0];
                expect(call[0]).toContain('%c');
                expect(call[0]).toContain('myModule');
            });

            it('handles object messages', async () => {
                const logger = await getDebugLogger();
                const obj = { count: 5, status: 'ready' };

                logger.info('testModule', obj);

                // Object should be passed directly (not stringified)
                const call = consoleSpies.info.mock.calls[0];
                expect(call).toContainEqual(obj);
            });

            it('handles util.* modules with two badges', async () => {
                const logger = await getDebugLogger();

                logger.log('util.format', 'Formatting');

                const call = consoleSpies.log.mock.calls[0];
                expect(call[0]).toContain('util');
                expect(call[0]).toContain('format');
            });
        });

        describe('when DEBUG is false', () => {
            it('logger.log does not call console', async () => {
                const logger = await getProductionLogger();

                logger.log('testModule', 'Test message');

                expect(consoleSpies.log).not.toHaveBeenCalled();
            });

            it('logger.info does not call console', async () => {
                const logger = await getProductionLogger();

                logger.info('testModule', 'Info message');

                expect(consoleSpies.info).not.toHaveBeenCalled();
            });

            it('logger.warn does not call console', async () => {
                const logger = await getProductionLogger();

                logger.warn('testModule', 'Warning');

                expect(consoleSpies.warn).not.toHaveBeenCalled();
            });

            it('logger.error does not call console', async () => {
                const logger = await getProductionLogger();

                logger.error('testModule', 'Error');

                expect(consoleSpies.error).not.toHaveBeenCalled();
            });
        });
    });

    describe('hnlLogger alias', () => {
        it('is the same as logger', async () => {
            delete window.location;
            window.location = { search: '?debug=true' };
            vi.resetModules();

            const { logger, hnlLogger } = await import('../core.log.mjs');

            expect(hnlLogger).toBe(logger);

            window.location = originalLocation;
        });
    });

    describe('badge style caching', () => {
        it('generates consistent colors for same module', async () => {
            delete window.location;
            window.location = { search: '?debug=true' };
            vi.resetModules();

            const { logger } = await import('../core.log.mjs');

            // Log twice with same module
            logger.info('testModule', 'First');
            logger.info('testModule', 'Second');

            // Both calls should have same styling
            const call1 = consoleSpies.info.mock.calls[0];
            const call2 = consoleSpies.info.mock.calls[1];

            // The style argument should be the same
            expect(call1[1]).toBe(call2[1]);

            window.location = originalLocation;
        });
    });
});
