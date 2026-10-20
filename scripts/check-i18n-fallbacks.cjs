const fs = require("node:fs/promises");
const path = require("node:path");
const ts = require("typescript");

const rootDir = process.cwd();
const baselinePath = path.join(rootDir, "scripts", "i18n-fallbacks-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");
const reportOnly = process.argv.includes("--report-only");

const scanTargets = [
  "apps/web/src",
  "apps/api/src",
  "packages/shared/src",
];

const ignoredPathFragments = [
  `${path.sep}admin${path.sep}`,
  `${path.sep}debug${path.sep}`,
  `${path.sep}i18n${path.sep}locales${path.sep}`,
];

const visibleSuffixes = [
  "title",
  "subtitle",
  "description",
  "label",
  "text",
  "placeholder",
  "alt",
  "cta",
  "button",
  "message",
  "content",
  "heading",
  "caption",
  "tooltip",
  "hint",
  "summary",
  "copy",
  "error",
  "empty",
];

const visibleAttributeNames = new Set([
  "title",
  "placeholder",
  "alt",
  "aria-label",
]);

const ignoredVisibleNames = new Set([
  "classname",
  "filename",
  "variant",
  "textsize",
]);

const literalIgnoreSet = new Set(["use client"]);

async function walkFiles(dirPath) {
  const absoluteDir = path.join(rootDir, dirPath);
  let entries = [];

  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    if (ignoredPathFragments.some((fragment) => absolutePath.includes(fragment))) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(path.join(dirPath, entry.name))));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(absolutePath);
    }
  }
  return files;
}

function relativize(filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function normalizeName(name) {
  return String(name).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeLiteral(value) {
  return value.replace(/\s+/g, " ").trim();
}

function getStringLiteralValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return normalizeLiteral(node.text);
  }
  return null;
}

function isEnglishLikeLiteral(value) {
  if (!value) {
    return false;
  }
  const literal = normalizeLiteral(value);
  if (!literal || literalIgnoreSet.has(literal)) {
    return false;
  }
  if (!/[A-Za-z]/.test(literal)) {
    return false;
  }
  if (/^https?:\/\//i.test(literal)) {
    return false;
  }
  if (/^[A-Z0-9_/-]+$/.test(literal)) {
    return false;
  }
  return true;
}

function getNodeLocation(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function getLineText(sourceFile, lineNumber) {
  return sourceFile.text.split(/\r?\n/)[lineNumber - 1]?.trim() || "";
}

function getPropertyNameText(nameNode) {
  if (!nameNode) {
    return "";
  }
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) {
    return nameNode.text;
  }
  return nameNode.getText();
}

function isVisibleName(name) {
  const normalized = normalizeName(name);
  if (!normalized || ignoredVisibleNames.has(normalized)) {
    return false;
  }
  return visibleSuffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(suffix)
  );
}

function getJsxAttributeName(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) {
      return current.name.text;
    }
    if (
      ts.isJsxElement(current) ||
      ts.isJsxFragment(current) ||
      ts.isSourceFile(current)
    ) {
      break;
    }
    current = current.parent;
  }
  return "";
}

function findVisibilityContext(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxExpression(current)) {
      const attributeName = getJsxAttributeName(current);
      if (
        !attributeName ||
        visibleAttributeNames.has(attributeName) ||
        isVisibleName(attributeName)
      ) {
        return {
          category: "jsx-fallback",
          context: attributeName ? `jsx:${attributeName}` : "jsx:children",
        };
      }
    }

    if (ts.isPropertyAssignment(current)) {
      const propertyName = getPropertyNameText(current.name);
      if (isVisibleName(propertyName)) {
        return {
          category: "object-fallback",
          context: `object:${propertyName}`,
        };
      }
    }

    if (ts.isCallExpression(current)) {
      const calleeText = current.expression.getText();
      if (/^(alert|confirm)$/.test(calleeText) || calleeText.includes("toast")) {
        return {
          category: "feedback-fallback",
          context: `call:${calleeText}`,
        };
      }
    }

    if (ts.isNewExpression(current) && current.expression.getText() === "Error") {
      return {
        category: "error-fallback",
        context: "new:Error",
      };
    }

    current = current.parent;
  }
  return null;
}

function makeSignature(finding) {
  return [
    finding.file,
    finding.line,
    finding.category,
    finding.context,
    finding.literal,
  ].join("|");
}

function collectBinaryFallback(node, sourceFile, findings, filePath) {
  if (
    !ts.isBinaryExpression(node) ||
    (node.operatorToken.kind !== ts.SyntaxKind.BarBarToken &&
      node.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken)
  ) {
    return;
  }

  const literalValue = getStringLiteralValue(node.right);
  if (!isEnglishLikeLiteral(literalValue)) {
    return;
  }

  const context = findVisibilityContext(node);
  if (!context) {
    return;
  }

  const line = getNodeLocation(sourceFile, node);
  findings.push({
    file: relativize(filePath),
    line,
    category: context.category,
    context: context.context,
    literal: literalValue,
    code: getLineText(sourceFile, line),
  });
}

function collectDefaultAssignment(node, sourceFile, findings, filePath) {
  if (!ts.isBindingElement(node) || !node.initializer) {
    return;
  }

  const literalValue = getStringLiteralValue(node.initializer);
  if (!isEnglishLikeLiteral(literalValue)) {
    return;
  }

  const bindingName = ts.isIdentifier(node.name) ? node.name.text : node.name.getText();
  if (!isVisibleName(bindingName)) {
    return;
  }

  let current = node.parent;
  while (current && !ts.isParameter(current) && !ts.isSourceFile(current)) {
    current = current.parent;
  }

  if (!current || !ts.isParameter(current)) {
    return;
  }

  const line = getNodeLocation(sourceFile, node);
  findings.push({
    file: relativize(filePath),
    line,
    category: "prop-default",
    context: `prop:${bindingName}`,
    literal: literalValue,
    code: getLineText(sourceFile, line),
  });
}

function traverse(node, sourceFile, findings, filePath) {
  collectBinaryFallback(node, sourceFile, findings, filePath);
  collectDefaultAssignment(node, sourceFile, findings, filePath);
  ts.forEachChild(node, (child) => traverse(child, sourceFile, findings, filePath));
}

async function collectFindings() {
  const files = [];
  for (const target of scanTargets) {
    files.push(...(await walkFiles(target)));
  }

  const findings = [];

  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );

    traverse(sourceFile, sourceFile, findings, file);
  }

  findings.sort((a, b) => {
    const left = `${a.file}:${String(a.line).padStart(6, "0")}:${a.context}:${a.literal}`;
    const right = `${b.file}:${String(b.line).padStart(6, "0")}:${b.context}:${b.literal}`;
    return left.localeCompare(right);
  });

  return findings;
}

async function readBaseline() {
  try {
    const content = await fs.readFile(baselinePath, "utf8");
    const parsed = JSON.parse(content);
    const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
    return new Set(findings);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeBaseline(findings) {
  const payload = {
    generatedAt: new Date().toISOString(),
    findings: findings.map(makeSignature),
  };
  await fs.writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const findings = await collectFindings();

  if (updateBaseline) {
    await writeBaseline(findings);
    console.log(`[i18n-fallback-check] baseline updated with ${findings.length} findings`);
    return;
  }

  const baseline = await readBaseline();
  if (!baseline) {
    const message = "[i18n-fallback-check] baseline not found";
    const instruction = "Run: node scripts/check-i18n-fallbacks.cjs --update-baseline";
    if (reportOnly) {
      console.warn(message);
      console.warn(instruction);
      return;
    }
    console.error(message);
    console.error(instruction);
    process.exitCode = 1;
    return;
  }

  const newFindings = findings.filter((item) => !baseline.has(makeSignature(item)));

  if (newFindings.length === 0) {
    console.log(
      `[i18n-fallback-check] no new suspicious English fallback/default literals found (baseline size: ${baseline.size}, current: ${findings.length})`
    );
    return;
  }

  const logger = reportOnly ? console.warn : console.error;
  logger(`[i18n-fallback-check] found ${newFindings.length} new suspicious user-visible English fallback/default literals`);
  newFindings.forEach((item) => {
    logger(`${item.file}:${item.line}`);
    logger(`  category: ${item.category}`);
    logger(`  context: ${item.context}`);
    logger(`  literal: ${item.literal}`);
    logger(`  code: ${item.code}`);
  });
  if (!reportOnly) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
