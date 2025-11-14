// util.d.ts

/**
 * Visibility detection
 */
export function isVisible(
    element: Element,
    callback: (visible: boolean, fullyVisible?: boolean, rect?: DOMRect) => void,
    viewport?: { top?: number; bottom?: number; left?: number; right?: number }
): void;

export function isVisibleNow(
    element: Element,
    callback: (visible: boolean, fullyVisible: boolean, entry: IntersectionObserverEntry) => void,
    options?: {
        rootMargin?: string;
        threshold?: number[];
        checkObstructions?: boolean;
    }
): IntersectionObserver;

export function isResizedNow(
    element: Element,
    callback: (entry: ResizeObserverEntry) => void
): () => void;

export function watchVisibility(
    element: Element,
    callback?: (
        isVisible: boolean,
        isFullyVisible: boolean,
        data: { visibilityObserver: any; resizeObserver: any; visibility_data: any; resize_data: any }
    ) => void,
    disconnectWhenVisible?: boolean
): Promise<void>;

export function isUnobstructed(element: Element): boolean;

export function getBlockerHeight(el: Element, x: number, startY?: number): number;

/**
 * Debouncing
 */
export function debounceThis(
    callback: Function,
    opts?: {
        threshold?: number;
        execStart?: boolean;
        execWhile?: boolean;
        execDone?: boolean;
    }
): Function;

export function debouncedEvent(
    target: EventTarget,
    events: string,
    callback: Function,
    delay?: number,
    after?: boolean,
    during?: boolean
): () => void;

/**
 * DOM utilities
 */
export function waitForComplexNode(
    getNode: () => Element | null,
    callback: (node: Element) => void,
    timeout?: number,
    interval?: number
): void;

export function stringToObj(string: string): ChildNode | NodeList;

export function getScriptPath(): string;

export function writeCSS(src: string): boolean;

/**
 * Color tool
 */
export class ColorTool {
    constructor(
        degsteps?: number,
        startsat?: number,
        startbri?: number,
        startdeg?: number,
        gradsteps?: number,
        paletlimit?: [number, number]
    );

    new(b?: number | string, s?: number): {
        string: string;
        values: number[];
        contra: string;
        hex: string;
    };

    adjust(opts: { deg?: number; sat?: number; bri?: number; opa?: number }): {
        string: string;
        values: number[];
        contra: string;
        hex: string;
    };
}

declare const colorTool: ColorTool;
export default colorTool;

/**
 * String formatting
 */
export function cleanUpString(string: string): string;
export function formatPhone(phone: string): string;
export function formatHref(urlString: string): string;
export function formatString(string: string, validateAs?: 'auto' | 'phone'): string;

/**
 * Math utilities
 */
export function toMS(s: string): number;
export function cubicBezier(controlPoints: [number, number, number, number], t: number): number;
export function getRandomInt(min: number, max: number): number;

/**
 * Performance utilities
 */
export function snapScrollComplete(
    element: HTMLElement,
    callbackSnap?: Function,
    callbackStop?: Function
): void;

export class FpsCounter {
    constructor(callback?: (fps: number) => void);
    fps: number;
    start(): void;
}

export class EasedMeanCalculator {
    getValue(value: number, type?: string, range?: number): number;
    reset(type: string): void;
}

export function pageScrollPercentage(): number;

/**
 * Iteration utilities
 */
export function objForEach(
    object: object,
    callback: (key: string, value: any, index: number, object: object) => void,
    callbackDone?: () => void,
    thisArg?: any
): void;

export function forEachBatched(
    obj: object,
    callback: (value: any, key: string, obj: object) => void,
    doneCallback: (lastValue: any, lastKey: string, obj: object) => void,
    batchSize?: number
): void;

/**
 * Media info
 */
export default function mediaInfo(feature: string, value?: string): boolean;

/**
 * Viewport scroller
 */
export class ViewportScroller {
    constructor(
        el: Element,
        opts?: {
            behavior?: 'auto' | 'smooth';
            extraOffset?: number;
        }
    );
    ensureVisible(): void;
}