# 网站图标（Favicon）说明

本文档说明 MP3ToText 项目在 `apps/web/src/app/` 目录下使用的四个图标文件：尺寸要求、各自作用，以及维护注意事项。

## 文件清单

| 文件 | 尺寸 | 格式 |
|------|------|------|
| `favicon.ico` | 内嵌 16×16、32×32、48×48 | ICO |
| `icon.png` | 96×96 | PNG |
| `icon.svg` | 声明 48×48（viewBox `0 0 28 28`） | SVG |
| `apple-icon.png` | 180×180 | PNG |

四个文件均放在：

```
apps/web/src/app/
├── favicon.ico
├── icon.png
├── icon.svg
└── apple-icon.png
```

Next.js App Router 会通过**文件约定**自动识别并注入 `<head>` 中的 `<link>` 标签，**无需在 `layout.tsx` 中额外配置**。

---

## 各文件作用

### 1. `favicon.ico`

**作用**

- 提供根路径 `/favicon.ico`（许多浏览器、爬虫、书签会直接请求此 URL）
- 作为旧版浏览器与部分客户端的 **fallback** 图标
- 补充 Google 等搜索引擎对 favicon 的抓取（常与 PNG 配合使用）

**尺寸说明**

- 只需 **1 个 `.ico` 文件**，内部打包多个尺寸图层（不是 3 个独立文件）
- 推荐内嵌：**16×16**、**32×32**、**48×48**
  - 16×16：普通 DPI 浏览器标签页
  - 32×32：Retina / 高分屏标签页
  - 48×48：Google 建议的下限尺寸、部分系统 UI

**使用场景**

- 浏览器标签页（部分浏览器）
- 书签栏
- 直接访问 `/favicon.ico` 的爬虫与工具

---

### 2. `icon.png`

**作用**

- 现代浏览器 `rel="icon"` 的 **raster 主图标**
- **Google 搜索结果 favicon 的首选来源之一**（建议 ≥48px）
- 在不支持 SVG favicon 的环境下提供清晰位图

**尺寸说明**

- 推荐：**96×96 px**
- 最低：**48×48 px**（满足 Google 官方建议）
- 必须为 **1:1 正方形**

**使用场景**

- Google 搜索结果中的站点图标
- Chrome / Firefox / Safari 等现代浏览器标签页
- 需要高清 raster 图标的场景

---

### 3. `icon.svg`

**作用**

- 矢量 favicon，任意缩放不失真
- 现代浏览器的 `rel="icon"` 补充（`type="image/svg+xml"`）
- 文件体积小，适合作为可缩放备用图标

**尺寸说明**

- 声明尺寸：**48×48**（`width` / `height`）
- `viewBox` 定义绘图坐标系（当前为 `0 0 28 28`）
- 必须为 **1:1 正方形**

**使用场景**

- 现代浏览器标签页（优先选用 SVG 或 PNG，因浏览器而异）
- 高 DPI 屏幕下的清晰显示

**注意**

- Google 官方支持 SVG，但搜索结果中 **PNG + ICO 组合通常更稳定**
- 不应作为唯一 favicon 来源；应与 `icon.png`、`favicon.ico` 配合使用

---

### 4. `apple-icon.png`

**作用**

- iOS / iPadOS「添加到主屏幕」时的 **Apple Touch Icon**
- 对应 `<link rel="apple-touch-icon">`
- **不参与** Google 搜索 favicon 的主要选取逻辑

**尺寸说明**

- 推荐：**180×180 px**（Apple 常用尺寸）
- 必须为 **1:1 正方形**

**使用场景**

- iPhone / iPad 主屏幕快捷方式图标
- Safari 部分场景

---

## 浏览器标签页 vs Google 搜索结果

| 场景 | 通常使用的文件 | 说明 |
|------|----------------|------|
| 浏览器标签页（现代） | `icon.svg` 或 `icon.png` | 浏览器从多个 `rel="icon"` 中自行选择 |
| 浏览器标签页（旧版 / fallback） | `favicon.ico` | 直接请求 `/favicon.ico` 或回退到 ICO |
| Google 搜索结果 | `icon.png`（优先）、`favicon.ico`（补充） | Google 从首页 `<link rel="icon">` 中选取；更新可能有数天～数周延迟 |
| iOS 主屏幕 | `apple-icon.png` | 仅 Apple 生态 |

**重要**：浏览器标签页能显示图标，不代表 Google 搜索结果中一定已更新；两者使用不同的抓取与缓存机制。

---

## Google 官方要求（摘要）

- 首页 `<head>` 中需有 `<link rel="icon" href="...">`
- 图标必须为 **1:1 正方形**
- 最小 **8×8 px**，**强烈建议大于 48×48 px**
- 支持 SVG、PNG、ICO 等合法格式
- 首页与 favicon 文件须可被 Googlebot 抓取（不可被 `robots.txt` 屏蔽）
- favicon URL 应相对稳定
- 每个 hostname 仅支持一个 favicon

参考：[Google Search Central - Favicon](https://developers.google.com/search/docs/appearance/favicon-in-search)

---

## 维护与导出

### 何时需要重新导出

仅在修改 **图形设计**（路径、颜色、圆角、留白等）时需要同步更新全部四个文件。  
仅调整 `icon.svg` 的声明尺寸（如 32→48）而图形未变时，**不必**重新导出 PNG / ICO。

### 推荐导出流程

```
设计源（Figma / 512×512 PNG / icon.svg）
        ↓
导出 icon.png（96×96）
导出 favicon.ico（内嵌 16 / 32 / 48）
保留或更新 icon.svg（48×48 声明）
保留或更新 apple-icon.png（180×180）
        ↓
放入 apps/web/src/app/ 并部署
```

### 设计源与页面 Logo 的关系

- Favicon 系列（`icon.*`、`favicon.ico`、`apple-icon.png`）：带品牌底色 `#0C7A7C` 的完整图标
- 页面 Logo（`LogoMark` 组件）：无底色，使用 `currentColor`，用于 Header 等 UI 场景

两者图形一致，但用途与样式不同，修改设计时需分别检查。

---

## 部署后验证

1. 访问 `https://mp3totext.io/favicon.ico` → 应返回 200
2. 访问 `https://mp3totext.io/icon.png` → 应返回 200
3. 查看首页 HTML，确认存在多个 `rel="icon"` 及 `apple-touch-icon` 链接
4. 在 Google Search Console 对首页请求重新索引（favicon 在 SERP 中更新仍可能需要等待）

---

## 相关项目配置

- 图标目录：`apps/web/src/app/`
- 路由排除：`apps/web/src/proxy.ts` 已将 `favicon.ico`、`icon.png`、`icon.svg`、`apple-icon.png` 排除在 locale 中间件之外，避免误 rewrite
