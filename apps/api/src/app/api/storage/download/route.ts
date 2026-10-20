import { NextRequest } from "next/server";
import { getEnv } from "@markless/shared/src/lib/config/env";
import { normalizeR2Domain, resolveR2Endpoint } from "@markless/server/src/lib/storage/r2-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOWNLOAD_TIMEOUT_MS = 30000;

function sanitizeFilename(value: string | null): string {
    const fallback = "download.bin";
    const normalized = (value || "").trim();
    if (!normalized) {
        return fallback;
    }

    const cleaned = normalized
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return cleaned || fallback;
}

function buildContentDisposition(filename: string): string {
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
    const encoded = encodeURIComponent(filename);
    return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

function getAllowedHosts(): string[] {
    const hosts = new Set<string>();

    const publicDomain = normalizeR2Domain(getEnv("R2_PUBLIC_DOMAIN"));
    if (publicDomain) {
        hosts.add(publicDomain);
    }

    const endpoint = resolveR2Endpoint();
    if (endpoint) {
        try {
            hosts.add(new URL(endpoint).hostname);
        } catch {
            // Ignore malformed endpoint here; route validation will still be safe.
        }
    }

    hosts.add("r2.cloudflarestorage.com");
    hosts.add("replicate.delivery");
    hosts.add("replicate.com");

    return [...hosts];
}

function isAllowedHost(hostname: string, allowedHosts: string[]): boolean {
    return allowedHosts.some(
        (host) => hostname === host || hostname.endsWith(`.${host}`)
    );
}

function validateDownloadUrl(rawUrl: string): URL {
    let parsed: URL;

    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error("Invalid download URL");
    }

    if (parsed.protocol !== "https:") {
        throw new Error("Only HTTPS download URLs are allowed");
    }

    if (!isAllowedHost(parsed.hostname, getAllowedHosts())) {
        throw new Error(`Download host not allowed: ${parsed.hostname}`);
    }

    return parsed;
}

export async function GET(request: NextRequest) {
    const urlParam = request.nextUrl.searchParams.get("url");
    const filenameParam = request.nextUrl.searchParams.get("filename");

    if (!urlParam) {
        return new Response("Missing download url", { status: 400 });
    }

    let sourceUrl: URL;
    try {
        sourceUrl = validateDownloadUrl(urlParam);
    } catch (error) {
        return new Response(
            error instanceof Error ? error.message : "Invalid download url",
            { status: 400 }
        );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

    try {
        const upstream = await fetch(sourceUrl.toString(), {
            method: "GET",
            redirect: "follow",
            cache: "no-store",
            signal: controller.signal,
        });

        if (!upstream.ok) {
            return new Response(
                `Download source returned ${upstream.status}`,
                { status: 502 }
            );
        }

        const contentType =
            upstream.headers.get("content-type") || "application/octet-stream";
        const contentLength = upstream.headers.get("content-length");
        const filename = sanitizeFilename(filenameParam);
        const body = await upstream.arrayBuffer();

        return new Response(body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": buildContentDisposition(filename),
                "Cache-Control": "private, no-store",
                ...(contentLength ? { "Content-Length": contentLength } : {}),
            },
        });
    } catch (error) {
        const isAbortError =
            typeof error === "object" &&
            error !== null &&
            "name" in error &&
            error.name === "AbortError";

        return new Response(
            isAbortError ? "Download request timed out" : "Failed to fetch download source",
            { status: isAbortError ? 504 : 502 }
        );
    } finally {
        clearTimeout(timeout);
    }
}
