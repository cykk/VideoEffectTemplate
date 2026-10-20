import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import i18next from "eslint-plugin-i18next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const i18nRuleOptions = {
  markupOnly: true,
  onlyAttribute: ["placeholder", "alt", "title", "aria-label", "aria-description"],
  ignoreAttribute: [
    "className",
    "id",
    "role",
    "type",
    "rel",
    "aria-hidden",
    "data-testid",
  ],
  ignoreCallee: ["t", "i18n.t", "i18next.t"],
  ignoreComponent: ["Icon", "Svg", "Trans"],
  ignore: [
    "^/", 
    "^https?://", 
    "^\\d+(\\.\\d+)?(GB|MB|K|M|B|%)$",
    "^MP3 to Text$", // 品牌名称
  ],
};

const hardcodedColorPattern = "#(?:[0-9A-Fa-f]{3,8})\\b|rgba\\s*\\(";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    settings: {
      next: {
        rootDir: ["apps/web/"],
      },
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Debug 组件（仅开发环境使用）
      "apps/web/src/components/debug/**",
      // 演示/预览组件
      "apps/web/src/components/tasks/task-card-preview.tsx",
      "apps/web/src/components/tasks/demo-video-player.tsx",
      // UI 基础组件（包含通用无障碍文本）
      "apps/web/src/components/ui/dialog.tsx",
      "apps/web/src/components/ui/sheet.tsx",
      // Logo 组件（包含品牌名称）
      "apps/web/src/components/header/header-logo.tsx",
    ],
  },
  {
    files: [
      "apps/web/src/**/*.{ts,tsx}",
      "packages/shared/src/**/*.{ts,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["warn", i18nRuleOptions],
      "no-restricted-syntax": [
        "warn",
        {
          selector: `Literal[value=/${hardcodedColorPattern}/i]`,
          message:
            "Hardcoded color detected (# or rgba). Use design tokens/CSS variables instead.",
        },
        {
          selector: `TemplateElement[value.raw=/${hardcodedColorPattern}/i]`,
          message:
            "Hardcoded color detected (# or rgba). Use design tokens/CSS variables instead.",
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/lib/analytics/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/analytics",
              message:
                "????????? shared analytics???? @/lib/analytics/project ????????",
            },
            {
              name: "@/lib/analytics/ga",
              message:
                "????????? ga client???? @/lib/analytics/project ????????",
            },
            {
              name: "@markless/server",
              message: "web ????? server-only ??",
            },
          ],
          patterns: [
            {
              group: ["@markless/server/*"],
              message: "web ????? server-only ??",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["apps/web/src/app/[locale]/admin/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  {
    files: ["apps/web/src/components/admin/**/*.{ts,tsx}"],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  {
    files: ["packages/shared/src/emails/email-theme.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    rules: {
      // 配置 @typescript-eslint/no-unused-vars 规则
      // 允许以 _ 开头的变量和参数不报未使用警告
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_",
          "caughtErrorsIgnorePattern": "^_"
        }
      ]
    }
  }
];

export default eslintConfig;
