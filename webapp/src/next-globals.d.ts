declare module "next/server" {
    export class NextRequest extends Request {
        constructor(input: RequestInfo | URL, init?: RequestInit);
        cookies: Map<string, string>;
        nextUrl: URL;
    }
    export class NextResponse extends Response {
        constructor(body?: BodyInit | null, init?: ResponseInit);
        static json(data: unknown, init?: ResponseInit): NextResponse;
        static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
        static rewrite(url: string | URL): NextResponse;
        static next(init?: ResponseInit): NextResponse;
    }
    export function after(fn: () => void | Promise<void>): void;
    export function connection(): Promise<boolean>;
}

declare module "next/server.js" {
    export * from "next/server";
}

declare module "next" {
    export interface Metadata {
        title?: string;
        description?: string;
        [key: string]: unknown;
    }
}

declare module "next/font/google" {
    export interface FontOptions {
        subsets?: string[];
        weight?: string | string[];
        display?: string;
        variable?: string;
        preload?: boolean;
        fallback?: string[];
        adjustFontFallback?: boolean;
    }
    export function Geist(options?: FontOptions): { className: string; variable: string };
    export function Geist_Mono(options?: FontOptions): { className: string; variable: string };
}

declare module "next/navigation" {
    export function useRouter(): {
        push: (url: string) => void;
        replace: (url: string) => void;
        back: () => void;
        forward: () => void;
        refresh: () => void;
        prefetch: (url: string) => void;
    };
    export function useSearchParams(): URLSearchParams;
    export function usePathname(): string;
    export function redirect(url: string): never;
    export function notFound(): never;
}

declare module "next/navigation.js" {
    export * from "next/navigation";
}

declare module "next/types.js" {
    import type { Metadata } from "next";
    export type { Metadata };
}
