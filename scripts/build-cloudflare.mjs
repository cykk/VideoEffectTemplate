import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "pnpm.exe" : "pnpm";
const result = spawnSync(
  command,
  ["--filter", "@markless/web", "run", "build:vinext"],
  {
    stdio: "inherit",
    env: { ...process.env, CF_WORKERS: "1" },
  }
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
