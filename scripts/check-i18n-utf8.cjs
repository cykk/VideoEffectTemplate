const fs = require("node:fs/promises");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const rootDir = process.cwd();
const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

const targetDirectories = [
  {
    dir: "i18n-assets/glossary",
    extension: ".csv",
    validator: validateGlossaryCsv,
  },
  {
    dir: "i18n-assets/overrides",
    extension: ".json",
    validator: validateJsonFile,
  },
  {
    dir: "i18n-assets/accepted",
    extension: ".json",
    validator: validateJsonFile,
  },
  {
    dir: "packages/shared/src/i18n/locales",
    extension: ".json",
    validator: validateJsonFile,
  },
];

const mojibakePatterns = [
  { name: "utf8-read-as-latin1", regex: /(?:Ã.|Â.|â€|â€œ|â€\u009d|â€™)/ },
];

async function walkFiles(dirPath, extension) {
  const absoluteDir = path.join(rootDir, dirPath);
  let dirEntries = [];

  try {
    dirEntries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = [];

  for (const entry of dirEntries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      const nestedFiles = await walkFiles(path.join(dirPath, entry.name), extension);
      files.push(...nestedFiles);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(extension)) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function readUtf8File(filePath) {
  const buffer = await fs.readFile(filePath);
  const text = utf8Decoder.decode(buffer);
  const hasBom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;

  return {
    buffer,
    text,
    hasBom,
  };
}

function relativize(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function validateJsonFile(text) {
  JSON.parse(text);
}

function validateGlossaryCsv(text) {
  const [header = ""] = text.split(/\r?\n/);
  if (header.trim() !== "source,target,comment") {
    throw new Error(`Unexpected CSV header: ${header}`);
  }
}

function findMojibakeMatches(text) {
  return mojibakePatterns
    .filter((rule) => rule.regex.test(text))
    .map((rule) => rule.name);
}

async function validateFile(filePath, validator) {
  const { text, hasBom } = await readUtf8File(filePath);
  if (text.includes("\uFFFD")) {
    throw new Error("Contains Unicode replacement character (U+FFFD).");
  }
  const matches = findMojibakeMatches(text);

  validator(text);

  return {
    file: relativize(filePath),
    hasBom,
    matches,
  };
}

async function main() {
  const results = [];
  const failures = [];

  for (const target of targetDirectories) {
    const files = await walkFiles(target.dir, target.extension);

    for (const filePath of files) {
      try {
        const result = await validateFile(filePath, target.validator);
        results.push(result);
      } catch (error) {
        failures.push({
          file: relativize(filePath),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  results.sort((left, right) => left.file.localeCompare(right.file));
  failures.sort((left, right) => left.file.localeCompare(right.file));

  console.log(`[utf8-check] scanned ${results.length + failures.length} files`);

  if (results.length > 0) {
    results.forEach((result) => {
      const suffix = [
        result.hasBom ? "bom" : null,
        result.matches.length > 0 ? `suspicious=${result.matches.join(",")}` : null,
      ]
        .filter(Boolean)
        .join(" ");

      console.log(`OK  ${result.file}${suffix ? `  ${suffix}` : ""}`);
    });
  }

  if (failures.length > 0) {
    failures.forEach((failure) => {
      console.error(`FAIL ${failure.file}  ${failure.reason}`);
    });
    process.exitCode = 1;
    return;
  }

  const suspiciousResults = results.filter((result) => result.matches.length > 0);
  if (suspiciousResults.length > 0) {
    suspiciousResults.forEach((result) => {
      console.error(
        `FAIL ${result.file}  suspicious mojibake markers: ${result.matches.join(",")}`,
      );
    });
    process.exitCode = 1;
    return;
  }

  console.log("[utf8-check] all translation assets passed UTF-8 validation");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
