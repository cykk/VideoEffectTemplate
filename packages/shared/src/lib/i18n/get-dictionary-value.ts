export function getDictionaryValue<T = string>(
  dictionary: Record<string, unknown>,
  path: string
): T | undefined {
  const segments = path.split(".");
  let current: unknown = dictionary;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    const record = current as Record<string, unknown>;
    if (!(segment in record)) {
      return undefined;
    }

    current = record[segment];
  }

  return current as T;
}
