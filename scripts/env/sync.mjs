#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  buildTargetContent,
  loadManifest,
  loadProfileValues,
  parseArgs,
} from "./lib.mjs";

function printHelp() {
  console.log(`Usage: node scripts/env/sync.mjs [--profile local|production|all] [--dry-run]

  --profile   Sync one profile or all (default: all)
  --dry-run   Print paths and byte counts without writing files
`);
}

function syncProfile(profile, manifest, options) {
  const profileConfig = manifest.profiles?.[profile];
  if (!profileConfig?.targets) {
    throw new Error(`Manifest has no targets for profile "${profile}".`);
  }

  const sharedValues = loadProfileValues(profile);
  const results = [];

  for (const [relativePath, targetConfig] of Object.entries(profileConfig.targets)) {
    const content = buildTargetContent(relativePath, targetConfig, sharedValues);
    const absolutePath = path.join(REPO_ROOT, relativePath);

    if (options.dryRun) {
      console.log(`[dry-run] ${relativePath} (${content.length} bytes)`);
    } else {
      fs.writeFileSync(absolutePath, content, "utf8");
      console.log(`Wrote ${relativePath}`);
    }
    results.push({ relativePath, content });
  }

  return results;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const manifest = loadManifest();
  const profiles =
    args.profile === "all" ? Object.keys(manifest.profiles ?? {}) : [args.profile];

  if (profiles.length === 0) {
    throw new Error("No profiles found in env/manifest.json");
  }

  for (const profile of profiles) {
    syncProfile(profile, manifest, args);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
