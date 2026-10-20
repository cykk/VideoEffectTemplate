## i18n 规范（默认遵守）
- 所有用户可见文案必须通过 i18n 字典获取，禁止硬编码。
- 当前项目按英文单语运行；新增文案只写入 `src/i18n/locales/en.json`。
- key 命名必须使用 `scope.domain.feature.section.element`。
- 新增 key 必须同步更新 `src/i18n/types.ts`（只新增字段，不改已有）。
- 适用范围：JSX 文本、placeholder/aria-label/alt/title、metadata、toast、校验/错误提示。
- 例外：`className`、`id`、`data-*`、`role`、`type`、`rel`、`aria-hidden`、SVG 属性、URL/路径/枚举 key。
- **特例豁免**：
  - `src/components/admin/**` - 后台管理面板，不需要多语言支持（仅面向内部管理员）
  - `src/app/[locale]/admin/**` - 后台管理路由页面，不强制 i18n（warn 级别）

## Execution Policy
- 持续执行任务直到完成，不要中途停顿或同步状态。
- 仅在必须用户审批权限时才请求确认。
- 非必要不要等待“继续”指令。
