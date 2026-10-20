module.exports = {
  defaultSeverity: "warning",
  ignoreFiles: ["apps/web/src/app/globals.css"],
  rules: {
    "declaration-property-value-disallowed-list": {
      "/.*/": [/#[0-9A-Fa-f]{3,8}\b/, /rgba\s*\(/],
    },
  },
};
