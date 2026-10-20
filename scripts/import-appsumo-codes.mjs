#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { randomBytes } from "node:crypto";

const DEFAULT_BATCH_ID = "appsumo-2026-03";
const DEFAULT_CREDITS = 3000;
const DEFAULT_CSV_PATH = path.join(process.cwd(), "docs", "appsumo-redemption-codes.csv");
const BATCH_SIZE = 100;

function parseArgs(argv) {
  const options = {
    csvPath: process.env.APPSUMO_CODES_CSV?.trim() || DEFAULT_CSV_PATH,
    batchId: process.env.APPSUMO_BATCH_ID?.trim() || DEFAULT_BATCH_ID,
    credits: Number.parseInt(process.env.APPSUMO_TIER1_CREDITS ?? "", 10) || DEFAULT_CREDITS,
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--csv") {
      options.csvPath = argv[index + 1] ?? options.csvPath;
      index += 1;
      continue;
    }

    if (arg === "--batch-id") {
      options.batchId = argv[index + 1] ?? options.batchId;
      index += 1;
    }
  }

  return options;
}

function createId() {
  return randomBytes(12).toString("hex");
}

function normalizeCode(raw) {
  return raw.trim().toUpperCase();
}

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function insertBatch(client, codes, batchId, credits) {
  if (codes.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const values = [];
  const params = [];

  codes.forEach((code, index) => {
    const base = index * 4;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, 'appsumo', 'appsumo_tier1', $${base + 4}, 'available', '{}'::jsonb, NOW(), NOW())`);
    params.push(createId(), code, batchId, credits);
  });

  const result = await client.query(
    `
      INSERT INTO redemption_codes (
        id,
        code,
        batch_id,
        provider,
        tier_id,
        credits_amount,
        status,
        metadata,
        created_at,
        updated_at
      )
      VALUES ${values.join(", ")}
      ON CONFLICT (code) DO NOTHING
    `,
    params
  );

  return {
    inserted: result.rowCount ?? 0,
    skipped: codes.length - (result.rowCount ?? 0),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  if (!fs.existsSync(options.csvPath)) {
    throw new Error(`CSV file not found: ${options.csvPath}`);
  }

  const rawLines = fs
    .readFileSync(options.csvPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const uniqueCodes = [...new Set(rawLines.map(normalizeCode))];

  console.log(`[import-appsumo-codes] CSV path: ${options.csvPath}`);
  console.log(`[import-appsumo-codes] Lines: ${rawLines.length}, unique codes: ${uniqueCodes.length}`);
  console.log(`[import-appsumo-codes] Batch: ${options.batchId}, credits: ${options.credits}`);

  if (options.dryRun) {
    console.log("[import-appsumo-codes] Dry run complete");
    return;
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    let inserted = 0;
    let skipped = 0;

    await client.query("BEGIN");

    for (const batch of chunkArray(uniqueCodes, BATCH_SIZE)) {
      const result = await insertBatch(client, batch, options.batchId, options.credits);
      inserted += result.inserted;
      skipped += result.skipped;
    }

    await client.query("COMMIT");

    console.log(`[import-appsumo-codes] Inserted: ${inserted}, skipped: ${skipped}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[import-appsumo-codes] Failed:", error);
  process.exitCode = 1;
});
