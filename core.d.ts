// core.d.ts

/**
 * Module exports interface - standard structure for DOMule modules
 */
export interface ModuleExports {
    NAME?: string;
    init?: (elements: NodeList | HTMLElement[]) => string | boolean | void;
    api?: (action: string, ...args: any[]) => any;
    destroy?: () => void;
}

/**
 * DOM Scanner - discovers elements with data-requires
 */
export interface DOMScanner {
    (callback?: (
        modules: Record<string, HTMLElement[]>,
        deferred: Record<string, HTMLElement[]>,
        stats: { immediate: number; lazy: number; total: number }
    ) => void): {
        modules: Record<string, HTMLElement[]>;
        deferred: Record<string, HTMLElement[]>;
        stats: { immediate: number; lazy: number; total: number };
    };
}

export const domScanner: DOMScanner;

/**
 * Module Loader - handles dynamic imports
 */
export function loadModules(
    paths?: Record<string, string> | (() => void),
    callback?: () => void
): void;

export function cleanup(): void;

/**
 * Module Registry - inter-module coordination
 */
export namespace ModuleRegistry {
    function register(
        name: string,
        module: ModuleExports,
        elements: HTMLElement[],
        state?: 'loaded' | 'error'
    ): void;

    function isLoaded(name: string): boolean;

    function get(name: string): ModuleExports | null;

    function getElements(name: string): HTMLElement[];

    function waitFor(name: string, timeout?: number): Promise<ModuleExports>;

    function unregister(name: string): void;

    function getAll(): Array<{
        name: string;
        state: string;
        elementCount: number;
    }>;
}

/**
 * Event Handler - centralized event management
 */
export interface EventHandler {
    addListener(event: string, callback: (e?: Event) => void): Function;
    removeListener(event: string, callback: Function): boolean;
    docLoaded(callback: () => void): Function;
    docReady(callback: () => void): Function;
    docShift(callback: (e?: Event) => void): Function;
    breakPointChange(callback: (e: CustomEvent) => void): Function;
    imgsLoaded(callback: () => void): Function;
}

declare const events: EventHandler;
export default events;

/**
 * Logger - debug output with color coding
 */
export interface Logger {
    log(moduleName: string, message: any): void;
    info(moduleName: string, message: any): void;
    warn(moduleName: string, message: any): void;
    error(moduleName: string, message: any): void;
}

export const logger: Logger;
export const hnlLogger: Logger; // v2.x compat
export function hasUrlParam(name: string, value?: string): boolean;

/**
 * Telemetry - performance tracking
 */
export interface Telemetry {
    recordModuleLoad(name: string, data: {
        size: number;
        duration: number;
        cached: boolean;
        elements: number;
        url: string;
    }): void;
    getReport(): {
        session: any;
        budget: any;
        utilization: { bytes: string; modules: string };
        violations: any[];
    };
    showDashboard(): void;
    isEnabled(): boolean;
}

export const telemetry: Telemetry;
