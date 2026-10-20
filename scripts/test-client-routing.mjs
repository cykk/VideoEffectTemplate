import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
globalThis.window = { location: { origin: "https://web.example" } };

for (const configured of [false, true]) {
  const result = await build({
    absWorkingDir: root,
    entryPoints: ["packages/shared/src/lib/http/client.ts"],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    define: {
      "process.env": JSON.stringify(configured ? {
        NEXT_PUBLIC_BROWSER_API_BASE_URL: "https://api.example/",
        NEXT_PUBLIC_BROWSER_AUTH_BASE_URL: "https://auth.example",
        NEXT_PUBLIC_BROWSER_SSE_BASE_URL: "https://stream.example",
      } : {}),
    },
  });
  const client = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
  assert.equal(client.buildClientApiUrl("/api/user/bootstrap"),
    `${configured ? "https://api.example" : "https://web.example"}/api/user/bootstrap`);
  assert.equal(client.buildClientSseUrl(),
    `${configured ? "https://stream.example" : "https://web.example"}/api/events/stream/user`);
  assert.equal(client.buildClientApiUrl("https://external.example/file"), "https://external.example/file");
  globalThis.fetch = async (url, init) => ({ url, ...init });
  const request = await client.apiFetch("/api/user/bootstrap");
  assert.equal(request.credentials, "include");
  assert.equal(request.mode, configured ? "cors" : undefined);
}
console.log("Client API routing, same-origin fallback, SSE and credential checks passed.");
