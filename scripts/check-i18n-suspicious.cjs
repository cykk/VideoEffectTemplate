const fs = require("node:fs/promises");
const path = require("node:path");

const { flattenJson } = require("./lib/i18n/flatten-json.cjs");
const { hasProtectedToken, isPureEmail, isPureUrl } = require("./lib/i18n/protect-tokens.cjs");

const rootDir = process.cwd();

const localeRuleSets = {
  ja: {
    highExposurePrefixes: [
      "header",
      "footer",
      "pages.pricing",
      "pages.payment",
      "pages.signup",
      "pages.profile",
      "pages.membership",
      "marketing.landing",
      "component.layout.header",
    ],
    safeSameAsSourceValues: new Set([
      "WatermarkRemover.tech",
      "TikTok",
      "Instagram",
      "YouTube",
      "Discord",
      "API",
      "SDK",
      "GraphQL",
      "REST API",
      "Cloudflare",
      "Cloudflare Pages",
      "PostgreSQL",
      "TypeScript",
      "React 19",
      "PayPal",
      "SendGrid",
      "Better Auth",
      "720p",
      "1080p",
      "720P & 1080P",
      "768p & 1080p",
      "FAQ",
      "Cookies",
      "Pro",
      "Normal",
      "OAuth",
      "Lite",
      "OpenAI",
      "Anthropic",
      "Stripe",
      "Supabase",
      "Vercel",
      "Google OAuth",
      "GitHub OAuth",
      "Magic Link",
    ]),
    mojibakePatterns: [
      /\?{3,}/u,
      /銈|銉|鍕|鐢|瑾/u,
      /脙./u,
      /脗./u,
      /芒鈧/u,
    ],
  },
  es: {
    highExposurePrefixes: [
      "header",
      "footer",
      "pages.pricing",
      "pages.payment",
      "pages.signup",
      "pages.profile",
      "marketing.landing.cta",
      "component.layout.header",
    ],
    safeSameAsSourceValues: new Set([
      "WatermarkRemover.tech",
      "TikTok",
      "Instagram",
      "YouTube",
      "Discord",
      "API",
      "SDK",
      "GraphQL",
      "REST API",
      "Cloudflare",
      "Cloudflare Pages",
      "PostgreSQL",
      "TypeScript",
      "React 19",
      "PayPal",
      "SendGrid",
      "Better Auth",
      "720p",
      "1080p",
      "720P & 1080P",
      "768p & 1080p",
      "FAQ",
      "Cookies",
      "Pro",
      "Normal",
      "OAuth",
    ]),
    mojibakePatterns: [
      /Ã./u,
      /Â./u,
      /â€(?:[˜™œ“”š›–—])/u,
      /â€™/u,
      /â€œ/u,
      /â€/u,
      /â€“/u,
      /â€”/u,
    ],
  },
};

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/check-i18n-suspicious.cjs --locale <locale>",
      "  node scripts/check-i18n-suspicious.cjs --locale <locale> --file packages/shared/src/i18n/locales/<locale>.json",
      "  node scripts/check-i18n-suspicious.cjs --locale <locale> --paths header,pages.pricing",
      "  node scripts/check-i18n-suspicious.cjs --locale <locale> --report-only",
      "",
      "Note:",
      "  This project currently ships in English-only mode.",
      "  Use this script only if multi-language locales are re-enabled later.",
    ].join("\n"),
  );
}

function parseArgs(argv) {
  const args = {
    locale: "",
    file: "",
    pathPrefixes: [],
    reportOnly: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];

    if (item === "--help" || item === "-h") {
      args.help = true;
      continue;
    }

    if (item === "--report-only") {
      args.reportOnly = true;
      continue;
    }

    if (item === "--locale") {
      args.locale = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (item === "--file") {
      args.file = argv[index + 1] || "";
      index += 1;
      continue;
    }

    if (item === "--paths") {
      args.pathPrefixes = (argv[index + 1] || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }
  }

  return args;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function writeJson(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 4)}\n`, "utf8");
}

async function writeText(filePath, value) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, value, "utf8");
}

function relativize(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function matchesPathPrefixes(entryPath, pathPrefixes) {
  if (pathPrefixes.length === 0) {
    return true;
  }

  return pathPrefixes.some((prefix) => entryPath === prefix || entryPath.startsWith(`${prefix}.`));
}

function hasAlphabet(text) {
  return /[\p{L}]/u.test(text);
}

function isSkippableText(text) {
  if (!text || !text.trim()) {
    return true;
  }

  if (isPureUrl(text) || isPureEmail(text)) {
    return true;
  }

  if (/^\/[^\s]+$/.test(text.trim())) {
    return true;
  }

  return false;
}

function isHighExposurePath(entryPath, ruleSet) {
  return ruleSet.highExposurePrefixes.some(
    (prefix) => entryPath === prefix || entryPath.startsWith(`${prefix}.`),
  );
}

function extractPlaceholders(text) {
  const patterns = [
    /\$\{[^}]+\}/g,
    /\{[A-Za-z0-9_.-]+\}/g,
    /%[0-9$.]*[sdifo]/gi,
  ];

  const matches = [];
  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      matches.push(match[0]);
    }
  });

  return [...new Set(matches)].sort();
}

function comparePlaceholderSets(sourceText, targetText) {
  const sourcePlaceholders = extractPlaceholders(sourceText);
  const targetPlaceholders = extractPlaceholders(targetText);

  if (sourcePlaceholders.length === 0 && targetPlaceholders.length === 0) {
    return null;
  }

  if (sourcePlaceholders.join("|") === targetPlaceholders.join("|")) {
    return null;
  }

  return {
    sourcePlaceholders,
    targetPlaceholders,
  };
}

function containsInternalQuestionMark(text) {
  return /(?<=\p{L})\?(?=\p{L})/u.test(text);
}

function containsRepeatedQuestionMarks(text) {
  return /\?{3,}/u.test(text);
}

function containsLegacyTokenResidue(text) {
  return /__TKN_\d+__|_+\s*_+\s*T\s*K\s*N\s*_\s*\d+\s*_+\s*_+/u.test(text);
}

function containsSuspiciousUnderscore(sourceText, targetText) {
  if (!targetText.includes("_") || sourceText.includes("_")) {
    return false;
  }

  if (/`[^`]*_[^`]*`/.test(targetText)) {
    return false;
  }

  return hasAlphabet(targetText);
}

function containsMojibake(text, ruleSet) {
  return ruleSet.mojibakePatterns.some((pattern) => pattern.test(text));
}

function looksEnglishLike(text, ruleSet) {
  if (!/[A-Za-z]/.test(text)) {
    return false;
  }

  if (ruleSet.safeSameAsSourceValues.has(text.trim())) {
    return false;
  }

  if (/^[A-Z0-9_/-]+$/.test(text.trim())) {
    return false;
  }

  return true;
}

function buildIssue({
  severity,
  type,
  path: entryPath,
  source,
  target,
  detail,
}) {
  return {
    severity,
    type,
    path: entryPath,
    source,
    target,
    detail,
  };
}

function buildReport({
  locale,
  targetFile,
  checkedEntries,
  issues,
}) {
  const errorIssues = issues.filter((item) => item.severity === "error");
  const warningIssues = issues.filter((item) => item.severity === "warn");

  const typeSummary = issues.reduce((result, issue) => {
    result[issue.type] = (result[issue.type] || 0) + 1;
    return result;
  }, {});

  const json = {
    locale,
    targetFile,
    generatedAt: new Date().toISOString(),
    summary: {
      checkedEntries,
      issueCount: issues.length,
      errorCount: errorIssues.length,
      warningCount: warningIssues.length,
      typeSummary,
    },
    issues,
  };

  const markdown = [
    `# ${locale} suspicious-text report`,
    "",
    `- target file: \`${targetFile}\``,
    `- checked entries: ${checkedEntries}`,
    `- issue count: ${issues.length}`,
    `- error count: ${errorIssues.length}`,
    `- warning count: ${warningIssues.length}`,
    "",
    "## issue summary by type",
    ...Object.entries(typeSummary)
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([type, count]) => `- ${type}: ${count}`),
    "",
    "## errors",
    ...(errorIssues.length > 0
      ? errorIssues.slice(0, 100).map(
          (issue) =>
            `- ${issue.path} [${issue.type}] ${issue.detail}\n  - source: ${JSON.stringify(issue.source)}\n  - target: ${JSON.stringify(issue.target)}`,
        )
      : ["- none"]),
    "",
    "## warnings",
    ...(warningIssues.length > 0
      ? warningIssues.slice(0, 100).map(
          (issue) =>
            `- ${issue.path} [${issue.type}] ${issue.detail}\n  - source: ${JSON.stringify(issue.source)}\n  - target: ${JSON.stringify(issue.target)}`,
        )
      : ["- none"]),
    "",
  ].join("\n");

  return { json, markdown };
}

async function resolveTargetFile(config, locale, explicitFile) {
  if (explicitFile) {
    return path.join(rootDir, explicitFile);
  }

  const generatedPath = path.join(rootDir, config.outputDir, `${locale}.generated.json`);
  if (await fileExists(generatedPath)) {
    return generatedPath;
  }

  return path.join(rootDir, config.outputDir, `${locale}.json`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.locale) {
    printUsage();
    if (!args.help) {
      process.exitCode = 1;
    }
    return;
  }

  const ruleSet = localeRuleSets[args.locale];
  if (!ruleSet) {
    throw new Error(`Unsupported locale for suspicious check: ${args.locale}`);
  }

  const configPath = path.join(rootDir, "i18n-assets", "config.json");
  const config = await readJson(configPath);
  const sourceJson = await readJson(path.join(rootDir, config.sourceFile));
  const targetFilePath = await resolveTargetFile(config, args.locale, args.file);
  const targetJson = await readJson(targetFilePath);

  const sourceEntries = flattenJson(sourceJson).filter((entry) =>
    matchesPathPrefixes(entry.path, args.pathPrefixes),
  );
  const targetMap = new Map(
    flattenJson(targetJson)
      .filter((entry) => matchesPathPrefixes(entry.path, args.pathPrefixes))
      .map((entry) => [entry.path, entry.text]),
  );

  const issues = [];

  sourceEntries.forEach((sourceEntry) => {
    const targetText = targetMap.get(sourceEntry.path);

    if (typeof targetText !== "string") {
      issues.push(
        buildIssue({
          severity: "error",
          type: "missing_path",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: "",
          detail: "Missing translated value for source path.",
        }),
      );
      return;
    }

    if (isSkippableText(targetText)) {
      return;
    }

    const placeholderMismatch = comparePlaceholderSets(sourceEntry.text, targetText);
    if (placeholderMismatch) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "placeholder_mismatch",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: `Placeholder mismatch: ${placeholderMismatch.sourcePlaceholders.join(", ")} -> ${placeholderMismatch.targetPlaceholders.join(", ")}`,
        }),
      );
    }

    if (hasProtectedToken(targetText)) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "token_residue",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Protected token residue remains in translated output.",
        }),
      );
    }

    if (containsLegacyTokenResidue(targetText)) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "legacy_token_residue",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Legacy token residue remains in translated output.",
        }),
      );
    }

    if (targetText.includes("\uFFFD")) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "replacement_character",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Contains Unicode replacement character (U+FFFD).",
        }),
      );
    }

    if (containsInternalQuestionMark(targetText)) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "internal_question_mark",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Contains '?' inside a word, which is suspicious for translated copy.",
        }),
      );
    }

    if (containsRepeatedQuestionMarks(targetText)) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "repeated_question_marks",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Contains repeated '?' characters, which usually indicates broken translated text.",
        }),
      );
    }

    if (containsSuspiciousUnderscore(sourceEntry.text, targetText)) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "stray_underscore",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Contains underscore artifact not present in source text.",
        }),
      );
    }

    if (containsMojibake(targetText, ruleSet)) {
      issues.push(
        buildIssue({
          severity: "error",
          type: "mojibake_marker",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "Contains suspicious mojibake marker sequence.",
        }),
      );
    }

    if (
      targetText === sourceEntry.text &&
      isHighExposurePath(sourceEntry.path, ruleSet) &&
      looksEnglishLike(targetText, ruleSet)
    ) {
      issues.push(
        buildIssue({
          severity: "warn",
          type: "same_as_source_high_exposure",
          path: sourceEntry.path,
          source: sourceEntry.text,
          target: targetText,
          detail: "High-exposure copy is unchanged from source English.",
        }),
      );
    }
  });

  const report = buildReport({
    locale: args.locale,
    targetFile: relativize(targetFilePath),
    checkedEntries: sourceEntries.length,
    issues,
  });

  const reportBasePath = path.join(rootDir, config.reportDir, `${args.locale}.suspicious`);
  await writeJson(`${reportBasePath}.json`, report.json);
  await writeText(`${reportBasePath}.md`, report.markdown);

  console.log(
    `[i18n-suspicious-check] locale=${args.locale} checked=${report.json.summary.checkedEntries} issues=${report.json.summary.issueCount} errors=${report.json.summary.errorCount} warnings=${report.json.summary.warningCount}`,
  );
  console.log(`[i18n-suspicious-check] report: ${relativize(`${reportBasePath}.json`)}`);
  console.log(`[i18n-suspicious-check] report: ${relativize(`${reportBasePath}.md`)}`);

  if (report.json.summary.issueCount > 0) {
    issues.slice(0, 20).forEach((issue) => {
      console.error(`${issue.severity.toUpperCase()} ${issue.path} [${issue.type}] ${issue.detail}`);
    });
  }

  if (!args.reportOnly && report.json.summary.errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
