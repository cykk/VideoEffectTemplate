#!/usr/bin/env node

import crypto from "node:crypto";
import pg from "pg";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BATCH_ID = "appsumo-internal-test";

function randomSegment(length = 5) {
  const bytes = crypto.randomBytes(length);
  let output = "";

  for (let index = 0; index < length; index += 1) {
    output += CHARSET[bytes[index] % CHARSET.length];
  }

  return output;
}

function generateCode() {
  return `AS-TRNV-${randomSegment()}-${randomSegment()}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new pg.Pool({ connectionString });

  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = generateCode();
      const id = crypto.randomBytes(12).toString("hex");

      const result = await pool.query(
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
          VALUES ($1, $2, $3, 'appsumo', 'appsumo_tier1', 3000, 'available', '{}'::jsonb, NOW(), NOW())
          ON CONFLICT (code) DO NOTHING
          RETURNING code, batch_id, credits_amount, status
        `,
        [id, code, BATCH_ID]
      );

      if (result.rows[0]) {
        console.log(JSON.stringify(result.rows[0], null, 2));
        return;
      }
    }

    throw new Error("Failed to generate a unique test code after 5 attempts");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("[insert-test-redemption-code] Failed:", error);
  process.exitCode = 1;
});
