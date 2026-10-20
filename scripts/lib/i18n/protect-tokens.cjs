const TOKEN_PATTERN = /ZXQPH\d+Q/u;
const URL_PATTERN = /https?:\/\/[^\s)]+/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const HTML_TAG_PATTERN = /<\/?[^>]+>/g;
const INLINE_CODE_PATTERN = /`[^`]+`/g;
const TEMPLATE_LITERAL_PATTERN = /\$\{[^}]+\}/g;
const SIMPLE_PLACEHOLDER_PATTERN = /\{[A-Za-z0-9_.-]+\}/g;
const PRINTF_PLACEHOLDER_PATTERN = /%[0-9$.]*[sdifo]/gi;

function buildToken(index, kind) {
  void kind;
  return `ZXQPH${index + 1}Q`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLiteralPattern(value) {
  const escapedValue = escapeRegExp(value);

  if (/[A-Za-z0-9]/.test(value)) {
    return new RegExp(`(?<![A-Za-z0-9])${escapedValue}(?![A-Za-z0-9])`, "gi");
  }

  return new RegExp(escapedValue, "g");
}

function replaceWithTokens(text, matcher, kind, tokens, restoreValueFactory) {
  return text.replace(matcher, (match) => {
    const token = buildToken(tokens.length, kind);
    tokens.push({
      token,
      original: match,
      restored: typeof restoreValueFactory === "function" ? restoreValueFactory(match) : match,
      kind,
    });
    return token;
  });
}

function replaceLiteralValues(text, values, kind, tokens) {
  let nextText = text;

  values
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .forEach((value) => {
      const matcher = buildLiteralPattern(value);
      nextText = replaceWithTokens(nextText, matcher, kind, tokens);
    });

  return nextText;
}

function replaceGlossaryValues(text, glossaryEntries, tokens) {
  let nextText = text;

  glossaryEntries
    .filter((entry) => entry && entry.source)
    .sort((left, right) => right.source.length - left.source.length)
    .forEach((entry) => {
      const matcher = buildLiteralPattern(entry.source);
      nextText = replaceWithTokens(nextText, matcher, "glossary", tokens, () => entry.target);
    });

  return nextText;
}

function protectText(text, options = {}) {
  const tokens = [];
  let maskedText = text;

  maskedText = replaceWithTokens(maskedText, HTML_TAG_PATTERN, "html", tokens);
  maskedText = replaceWithTokens(maskedText, URL_PATTERN, "url", tokens);
  maskedText = replaceWithTokens(maskedText, EMAIL_PATTERN, "email", tokens);
  maskedText = replaceWithTokens(maskedText, INLINE_CODE_PATTERN, "code", tokens);
  maskedText = replaceWithTokens(maskedText, TEMPLATE_LITERAL_PATTERN, "template", tokens);
  maskedText = replaceWithTokens(maskedText, SIMPLE_PLACEHOLDER_PATTERN, "placeholder", tokens);
  maskedText = replaceWithTokens(maskedText, PRINTF_PLACEHOLDER_PATTERN, "printf", tokens);

  maskedText = replaceLiteralValues(maskedText, options.brandNames || [], "brand", tokens);
  maskedText = replaceLiteralValues(maskedText, options.modelNames || [], "model", tokens);
  maskedText = replaceGlossaryValues(maskedText, options.glossaryEntries || [], tokens);

  return {
    maskedText,
    tokens,
  };
}

function buildLooseTokenPattern(token) {
  return token
    .split("")
    .map((char) => escapeRegExp(char))
    .join("\\s*");
}

function restoreText(text, tokens = []) {
  const restored = tokens.reduce((result, entry) => {
    const restoreValue = entry.restored ?? entry.original;
    const looseTokenPattern = buildLooseTokenPattern(entry.token);

    return result.replace(new RegExp(looseTokenPattern, "g"), restoreValue);
  }, text);

  return tokens.reduce((result, entry) => {
    const restoreValue = entry.restored ?? entry.original;

    if (!["brand", "model", "glossary"].includes(entry.kind)) {
      return result;
    }

    if (!/[\p{L}\p{N}]/u.test(restoreValue)) {
      return result;
    }

    const escapedValue = escapeRegExp(restoreValue);
    const addLeftSpacePattern = new RegExp(`(?<=[\\p{L}\\p{N}])(${escapedValue})`, "gu");
    const addRightSpacePattern = new RegExp(`(${escapedValue})(?=[\\p{L}\\p{N}])`, "gu");

    return result
      .replace(addLeftSpacePattern, " $1")
      .replace(addRightSpacePattern, "$1 ");
  }, restored);
}

function hasProtectedToken(text) {
  TOKEN_PATTERN.lastIndex = 0;
  return TOKEN_PATTERN.test(text);
}

function isPureUrl(text) {
  return /^https?:\/\/\S+$/.test(text.trim());
}

function isPureEmail(text) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());
}

module.exports = {
  hasProtectedToken,
  isPureEmail,
  isPureUrl,
  protectText,
  replaceGlossaryValues,
  restoreText,
};
