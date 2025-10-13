// module.d.ts (template for custom modules)

/**
 * Standard module structure for DOMule
 * Use this as reference when creating new modules
 */

/**
 * Module name (required for logging)
 */
export const NAME: string;

/**
 * Initialization function (required)
 * Called by DOMule after module import
 *
 * @param elements - All elements with data-requires for this module
 * @returns Optional status message or boolean
 */
export function init(elements: NodeList | HTMLElement[]): string | boolean | void;

/**
 * Module API (optional)
 * Enables inter-module coordination via ModuleRegistry
 *
 * @param action - Action name (getState, onChange, etc.)
 * @param args - Action-specific arguments
 * @returns Action-specific return value
 */
export function api(action: string, ...args: any[]): any;

/**
 * Cleanup function (optional)
 * Called before module unregistration
 * Remove listeners, disconnect observers, clear timers
 */
export function destroy(): void;