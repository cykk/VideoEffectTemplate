function flattenJson(value, currentPath = [], entries = []) {
  if (typeof value === "string") {
    entries.push({
      path: currentPath.join("."),
      text: value,
    });
    return entries;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenJson(item, currentPath.concat(String(index)), entries);
    });
    return entries;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      flattenJson(item, currentPath.concat(key), entries);
    });
  }

  return entries;
}

module.exports = {
  flattenJson,
};
