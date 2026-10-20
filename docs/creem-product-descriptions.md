# Creem 商品 Description 定稿

> 用于在 Creem 后台创建 mp3totext.io 定价商品时的 **Name** 与 **Description** 文案。  
> Description 支持 Markdown，已精简为结账页友好长度（约 30–45 词）。  
> **Description 规范：** 仅保留分钟 headline + 功能 bullet，不含档位定位 tagline（定位文案留在定价页）。  
> **Name 规范：** 仅表达档位 + 计费周期（`Monthly` / `Yearly`），分钟配额详情放在 Description。  
> 完整功能说明见网站定价页：https://mp3totext.io/pricing

---

## 配置备忘

| 字段 | 建议值 |
|------|--------|
| **Success / Return URL** | `https://mp3totext.io/dashboard` |
| **计量单位** | Transcription minutes（转写分钟） |

创建完成后，将 Creem 返回的 Product ID 写入 `.env.api.production` 的 `CREEM_SUBSCRIPTIONS` / `CREEM_PACKS`，与下方「内部 ID」一一对应。

> **说明：** 内部 ID（如 `credit_pack_800`）为历史命名，对用户展示一律使用 transcription minutes。

### Creem 商品类型与价格

| 商品 | Creem 类型 | 价格 (USD) |
|------|-----------|------------|
| Basic Monthly | Recurring · Monthly | $9 |
| Basic Yearly | Recurring · Yearly | $60 |
| Standard Monthly | Recurring · Monthly | $18 |
| Standard Yearly | Recurring · Yearly | $120 |
| Pro Monthly | Recurring · Monthly | $36 |
| Pro Yearly | Recurring · Yearly | $240 |
| 800 Minutes One-Time | One-time | $15 |
| 2000 Minutes One-Time | One-time | $30 |

---

## 订阅计划（6 个）

### 1. Basic — Monthly

- **内部 ID：** `tier1:monthly`
- **价格：** $9/月

**Name**

```
Basic Monthly
```

**Description**

```markdown
**800 minutes of transcription per month**

- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

### 2. Basic — Yearly

- **内部 ID：** `tier1:yearly`
- **价格：** $60/年（约 $5/月）

**Name**

```
Basic Yearly
```

**Description**

```markdown
*Annual billing. Minutes refresh every month.*

**800 minutes of transcription per month**

- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

### 3. Standard — Monthly

- **内部 ID：** `tier2:monthly`
- **价格：** $18/月

**Name**

```
Standard Monthly
```

**Description**

```markdown
**2,000 minutes of transcription per month**

- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

### 4. Standard — Yearly

- **内部 ID：** `tier2:yearly`
- **价格：** $120/年（约 $10/月）

**Name**

```
Standard Yearly
```

**Description**

```markdown
*Annual billing. Minutes refresh every month.*

**2,000 minutes of transcription per month**

- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

### 5. Pro — Monthly

- **内部 ID：** `tier3:monthly`
- **价格：** $36/月

**Name**

```
Pro Monthly
```

**Description**

```markdown
**6,000 minutes of transcription per month**

- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

### 6. Pro — Yearly

- **内部 ID：** `tier3:yearly`
- **价格：** $240/年（约 $20/月）

**Name**

```
Pro Yearly
```

**Description**

```markdown
*Annual billing. Minutes refresh every month.*

**6,000 minutes of transcription per month**

- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

## 一次性分钟包（2 个）

### 7. 800 Minutes — One-Time

- **内部 ID：** `credit_pack_800`
- **价格：** $15

**Name**

```
800 Minutes — One-Time Pack
```

**Description**

```markdown
**800 minutes of transcription**

- One-time purchase. Minutes never expire.
- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

### 8. 2000 Minutes — One-Time

- **内部 ID：** `credit_pack_2000`
- **价格：** $30

**Name**

```
2000 Minutes — One-Time Pack
```

**Description**

```markdown
**2,000 minutes of transcription**

- One-time purchase. Minutes never expire.
- Word, CSV, PDF, TXT, SRT, VTT exports · Text Summary
- Each file up to 10 hours · up to 5 GB
- 150 languages · up to 98% accuracy
```

---

## 内部 ID 与环境变量映射示例

创建 Creem 商品后，分别写入两个环境变量（将 `prod_xxx` 替换为 Creem 实际 Product ID）：

**`CREEM_SUBSCRIPTIONS`**

```json
{
  "tier1:monthly": "prod_xxx",
  "tier1:yearly": "prod_xxx",
  "tier2:monthly": "prod_xxx",
  "tier2:yearly": "prod_xxx",
  "tier3:monthly": "prod_xxx",
  "tier3:yearly": "prod_xxx"
}
```

**`CREEM_PACKS`**

```json
{
  "credit_pack_800": "prod_xxx",
  "credit_pack_2000": "prod_xxx"
}
```

相关代码：`packages/shared/src/lib/products/config.ts`
