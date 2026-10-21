import assert from "node:assert/strict";

const base = process.env.WORKERS_SMOKE_URL || "http://127.0.0.1:8787";
const checks = [
  ["/", 307, "/dashboard"],
  ["/blog", 200],
  ["/pricing", 200],
  ["/login", 200],
  ["/dashboard", 200],
  ["/en/blog", 308, "/blog"],
  ["/profile", 308, "/settings/account"],
  ["/sitemap.xml", 200],
  ["/robots.txt", 200],
  ["/does-not-exist", 404],
];

for (const [path, status, location] of checks) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  const body = await response.text();
  console.log(`${response.status} ${path} (${body.length} characters)`);
  assert.equal(response.status, status, path);
  if (location) {
    assert.equal(new URL(response.headers.get("location"), base).pathname, location);
  }
  if (status === 200 && response.headers.get("content-type")?.includes("text/html")) {
    assert.match(body, /<title>/, `${path}: missing SSR title`);
    const asset = body.match(/(?:src|href)="([^" ]*\/_next\/static\/[^" ]+\.(?:js|css))"/);
    if (asset) {
      const assetResponse = await fetch(new URL(asset[1], base));
      assert.equal(assetResponse.status, 200, `${path}: missing asset ${asset[1]}`);
    }
  }
}
console.log("Workers HTTP smoke checks passed.");
