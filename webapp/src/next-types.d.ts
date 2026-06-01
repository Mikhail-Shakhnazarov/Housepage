declare module "next/types.js" {
    export type { ResolvingMetadata, ResolvingViewport } from "next";
}

declare module "next/server.js" {
    export type { NextRequest, NextResponse, ImageResponse } from "next/server";
    export type { userAgent, userAgentFromString } from "next/server";
}
