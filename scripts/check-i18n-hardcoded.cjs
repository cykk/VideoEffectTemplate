const fs = require("node:fs/promises");
const path = require("node:path");
const ts = require("typescript");

const rootDir = process.cwd();
const baselinePath = path.join(rootDir, "scripts", "i18n-hardcoded-baseline.json");
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
  "button",
  "cta",
  "message",
  "content",
  "heading",
  "caption",
  "tooltip",
  "hint",
  "summary",
  "copy",
  "error",
  "alert",
  "faq",
  "note",
  "headline",
  "toast",
  "twitter",
  "innerhtml",
  "subject",
  "preview",
  "helpertext",
  "instruction",
  "instructions",
  "success",
  "warning",
  "detail",
  "reason",
  "dialog",
  "modal",
];

const callTargets = new Set([
  "alert",
  "confirm",
  "toast",
  "toast.success",
  "toast.error",
  "toast.info",
  "showToast",
  "notify",
  "enqueueToast",
  "enqueueSnackbar",
  "snackbar",
]);

const literalIgnoreSet = new Set([
  "use client",
  "en",
  "ja",
  "es",
  "locale",
  "true",
  "false",
  "n/a",
]);

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

function isPlaceholderLiteral(value) {
  return (
    /^\$\{[^}]+\}$/.test(value) ||
    /^\{[^}]+\}$/.test(value) ||
    /^%[sdifo]$/i.test(value)
  );
}

function getSimplePropertyName(nameNode) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteral(nameNode)) {
    return nameNode.text;
  }
  return "";
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
  if (!normalized) {
    return false;
  }
  return visibleSuffixes.some(
    (suffix) => normalized === suffix || normalized.endsWith(suffix)
  );
}

function getCallExpressionName(node) {
  if (ts.isIdentifier(node)) {
    return node.text;
  }
  if (ts.isPropertyAccessExpression(node)) {
    return `${node.expression.getText()}.${node.name.text}`;
  }
  return node.getText();
}

function getNodeTextValue(node) {
  if (ts.isJsxText(node)) {
    return normalizeLiteral(node.getText());
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return normalizeLiteral(node.text);
  }
  if (
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return normalizeLiteral(node.text);
  }
  return null;
}

function isEnglishLikeLiteral(value) {
  if (!value) {
    return false;
  }
  const trimmed = normalizeLiteral(value);
  if (!trimmed || literalIgnoreSet.has(trimmed.toLowerCase())) {
    return false;
  }
  if (isPlaceholderLiteral(trimmed)) {
    return false;
  }
  if (trimmed.length < 3) {
    return false;
  }
  if (!/[A-Za-z]/.test(trimmed)) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return false;
  }
  if (/^[a-z0-9]+(?:\.[a-z0-9]+){2,}$/i.test(trimmed)) {
    return false;
  }
  if (/^[A-Z0-9_/-]+$/.test(trimmed)) {
    return false;
  }
  if (/^[^A-Za-z0-9]+$/.test(trimmed)) {
    return false;
  }
  return true;
}

function getLineText(sourceFile, lineNumber) {
  return sourceFile.text.split(/\r?\n/)[lineNumber - 1]?.trim() || "";
}

function findLocaleObjectContext(node) {
  if (!ts.isPropertyAssignment(node)) {
    return null;
  }

  const localeName = normalizeName(getSimplePropertyName(node.name));
  if (!["en", "ja", "es", "zh"].includes(localeName)) {
    return null;
  }

  if (!ts.isObjectLiteralExpression(node.initializer)) {
    return null;
  }

  return {
    category: "locale-object",
    context: `locale:${localeName}`,
  };
}

function isStyleObjectProperty(node) {
  let current = node;

  while (current) {
    if (ts.isVariableDeclaration(current)) {
      const declarationName = ts.isIdentifier(current.name)
        ? normalizeName(current.name.text)
        : "";
      return (
        declarationName === "style" ||
        declarationName === "styles" ||
        declarationName.endsWith("style") ||
        declarationName.endsWith("styles")
      );
    }

    if (ts.isPropertyAssignment(current)) {
      const propertyName = normalizeName(getPropertyNameText(current.name));
      if (
        propertyName === "style" ||
        propertyName === "styles" ||
        propertyName.endsWith("style") ||
        propertyName.endsWith("styles")
      ) {
        return true;
      }
    }

    if (
      !ts.isObjectLiteralExpression(current.parent) &&
      !ts.isPropertyAssignment(current.parent) &&
      !ts.isVariableDeclaration(current.parent)
    ) {
      return false;
    }

    current = current.parent;
  }

  return false;
}

function isStructuredDataScriptAttribute(node) {
  if (!ts.isJsxAttribute(node) || node.name.text !== "dangerouslySetInnerHTML") {
    return false;
  }

  const element = node.parent?.parent;
  if (
    !element ||
    (!ts.isJsxSelfClosingElement(element) && !ts.isJsxOpeningElement(element)) ||
    element.tagName.getText() !== "script"
  ) {
    return false;
  }

  return element.attributes.properties.some((property) => {
    if (!ts.isJsxAttribute(property) || property.name.text !== "type") {
      return false;
    }

    const initializer = property.initializer;
    return !!initializer && ts.isStringLiteral(initializer) && initializer.text === "application/ld+json";
  });
}

function isTransparentVisibilityWrapper(parent, child) {
  if (
    ts.isParenthesizedExpression(parent) ||
    ts.isAsExpression(parent) ||
    ts.isTypeAssertionExpression(parent) ||
    ts.isNonNullExpression(parent) ||
    ts.isSatisfiesExpression(parent)
  ) {
    return true;
  }

  if (ts.isConditionalExpression(parent)) {
    return parent.whenTrue === child || parent.whenFalse === child;
  }

  if (ts.isBinaryExpression(parent)) {
    return parent.operatorToken.kind === ts.SyntaxKind.PlusToken;
  }

  if (ts.isTemplateSpan(parent)) {
    return parent.literal === child;
  }

  return false;
}

function hasDirectVisiblePath(node, stopNode) {
  let current = node;

  while (current && current !== stopNode) {
    const parent = current.parent;
    if (!parent || !isTransparentVisibilityWrapper(parent, current)) {
      return false;
    }
    current = parent;
  }

  return current === stopNode;
}

function isVisibleJsxAttributeLiteral(node, attribute) {
  const initializer = attribute.initializer;
  if (!initializer) {
    return false;
  }

  if (ts.isStringLiteral(initializer)) {
    return node === initializer;
  }

  if (ts.isJsxExpression(initializer) && initializer.expression) {
    return hasDirectVisiblePath(node, initializer.expression);
  }

  return false;
}

function isVisibleJsxExpressionLiteral(node, jsxExpression) {
  return !!jsxExpression.expression && hasDirectVisiblePath(node, jsxExpression.expression);
}

function isVisibleObjectPropertyLiteral(node, property) {
  return hasDirectVisiblePath(node, property.initializer);
}

function isVisibleCallArgumentLiteral(node, callExpression) {
  return callExpression.arguments.some((argument) => {
    if (argument === node) {
      return true;
    }
    return hasDirectVisiblePath(node, argument);
  });
}

function findVisibilityContext(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxAttribute(current)) {
      const attributeName = current.name.text;
      if (isStructuredDataScriptAttribute(current)) {
        return null;
      }
      if (
        (isVisibleName(attributeName) || attributeName === "dangerouslySetInnerHTML") &&
        isVisibleJsxAttributeLiteral(node, current)
      ) {
        return { category: "jsx-attribute", context: `jsx:${attributeName}` };
      }
      return null;
    }

    if (ts.isJsxExpression(current)) {
      if (ts.isJsxAttribute(current.parent)) {
        current = current.parent;
        continue;
      }
      if (isVisibleJsxExpressionLiteral(node, current)) {
        return { category: "jsx-expression", context: "jsx:children" };
      }
      return null;
    }

    if (ts.isJsxText(current)) {
      return { category: "jsx-text", context: "jsx:children" };
    }

    if (ts.isPropertyAssignment(current)) {
      const localeContext = findLocaleObjectContext(current);
      if (localeContext) {
        return localeContext;
      }

      if (isStyleObjectProperty(current)) {
        current = current.parent;
        continue;
      }

      const propertyName = getSimplePropertyName(current.name);
      if (
        propertyName &&
        isVisibleName(propertyName) &&
        isVisibleObjectPropertyLiteral(node, current)
      ) {
        return {
          category: "object-property",
          context: `object:${propertyName}`,
        };
      }
    }

    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      if (ts.isPropertyAccessExpression(current.left)) {
        const propertyName = normalizeName(current.left.name.text);
        if (propertyName === "innerhtml") {
          return { category: "innerHTML", context: "innerHTML:assignment" };
        }
      }
    }

    if (ts.isCallExpression(current)) {
      const calleeName = getCallExpressionName(current.expression);
      if (callTargets.has(calleeName) && isVisibleCallArgumentLiteral(node, current)) {
        return { category: "call", context: `call:${calleeName}` };
      }
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

function recordFinding(node, sourceFile, filePath, findings) {
  const literal = getNodeTextValue(node);
  if (!isEnglishLikeLiteral(literal)) {
    return;
  }

  const context = findVisibilityContext(node);
  if (!context) {
    return;
  }

  const line = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile)
  ).line + 1;

  findings.push({
    file: relativize(filePath),
    line,
    category: context.category,
    context: context.context,
    literal,
    code: getLineText(sourceFile, line),
  });
}

function traverse(node, sourceFile, findings, filePath) {
  if (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node) ||
    ts.isJsxText(node)
  ) {
    recordFinding(node, sourceFile, filePath, findings);
  }

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
    console.log(`[i18n-hardcoded-check] baseline updated with ${findings.length} findings`);
    return;
  }

  const baseline = await readBaseline();
  if (!baseline) {
    const message = "[i18n-hardcoded-check] baseline not found";
    const instruction = "Run: node scripts/check-i18n-hardcoded.cjs --update-baseline";
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
      `[i18n-hardcoded-check] no new suspicious literals found (baseline size: ${baseline.size}, current: ${findings.length})`
    );
    return;
  }

  const logger = reportOnly ? console.warn : console.error;
  logger(`[i18n-hardcoded-check] found ${newFindings.length} new suspicious literals`);
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
