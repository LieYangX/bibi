# 笔笔 (bibi) — Agent 指南

个人记账桌面应用（Electron + Vue 3 + TypeScript + Drizzle ORM + SQLite），现已集成 AI Agent、语音转文字与 MCP 扩展能力。

## 项目概览

| 项目     | 值                                                            |
| -------- | ------------------------------------------------------------- |
| 技术栈   | Electron 39, Vue 3.5, TypeScript 5.9, Vite 7, electron-vite 5 |
| 状态管理 | Pinia（8 个 store）                                           |
| 数据库   | SQLite via `better-sqlite3`                                   |
| ORM      | Drizzle ORM v0.45（better-sqlite3 原生同步驱动）              |
| AI       | Vercel AI SDK + `@ai-sdk/deepseek`，默认 `deepseek-v4-flash`   |
| STT      | `@huggingface/transformers`（ Whisper 目录当前为空）           |
| MCP      | 支持用户配置 MCP 服务器并动态加载为工具                         |
| 图表     | ECharts 6 + vue-echarts 8                                     |
| 图标     | @lucide/vue                                                   |
| 包管理器 | npm                                                           |
| 打包     | electron-builder 26，`asar: true`，原生模块自动解包           |
| 设计系统 | 暖金色主题（`--bb-accent: #d9a404`），CSS 自定义属性          |

## 目录结构

```
src/
  main/                   # Electron 主进程
    index.ts              # 最小入口：调用 bootstrapApplication()
    app/                  # 生命周期与启动编排
    windows/              # BrowserWindow 创建与 Web 安全策略
    database/
      index.ts            # 数据库连接初始化与关闭
      seed.ts             # 预设分类事务化写入
      presets.ts          # 10 个支出 + 5 个收入预设分类（含二级分类）
      drizzle/
        schema.ts         # Drizzle ORM 表结构定义（12 张表）
        index.ts          # better-sqlite3 连接，导出 db 实例 + schema
        migrations/       # 迁移 SQL 文件 + 自定义迁移运行器
    services/             # 业务逻辑与跨领域应用服务
    ipc/                  # IPC 注册、可信来源校验和统一异常映射
    agent/                # AI Agent 编排器、LLM 网关、Skill、MCP、记忆
      skills/             # 5 个内置 Skill：data-query / calculator / report / analysis / transaction-write
      memory/             # 会话持久化与短期记忆
    utils/                # 结构化日志、日志脱敏
  preload/
    index.ts              # contextBridge 暴露 electronAPI
    index.d.ts            # Window.electronAPI 全局类型声明
  renderer/               # Vue 3 前端
    src/
      main.ts             # Vue 入口：Pinia → Router → bootstrap 用户状态
      App.vue
      api/desktop-api.ts  # 渲染进程唯一桌面 API 适配入口
      router/             # Vue Router（hash 路由，懒加载）
      stores/             # 8 个 Pinia stores
      views/              # 页面 + sections/ 子目录
      components/         # bb- 前缀 UI 组件库 + 通用组件
      composables/        # useRefreshBus（发布-订阅刷新总线）
      assets/             # base.css（--bb-* 变量）、ui.css（bb-btn 等）、图片
  shared/
    ipc/                  # IPC 频道常量与 Zod 参数规则
    types/                # 三进程共享 DTO、响应和 ElectronAPI 契约
    security/             # URL 安全校验
tests/
  unit/                   # 纯 TypeScript 单元测试（Vitest）
  integration/            # Electron ABI 数据库集成测试
scripts/
  generate-icons.mjs      # 从 resources/icon.png 生成 build/icon.ico/png
  clean-onnxruntime.mjs   # 清理非当前平台 onnxruntime-node 二进制，减小打包体积
```

## 架构要点

### 三进程通信

```
渲染进程 → desktopApi → contextBridge → IPC 统一处理器 → services → Drizzle ORM → better-sqlite3
```

- 所有 IPC 调用使用 `src/shared/ipc/channels.ts` 定义的频道常量和 `src/shared/ipc/schemas.ts` 的 Zod 参数规则。
- 主进程统一执行 Zod 校验、可信 sender 校验、耗时日志和异常映射。
- `src/main/ipc/handle-ipc.ts` 提供 `registerIpcHandler`（通用）和 `registerUserIpcHandler`（自动注入当前 userId）。
- 渲染进程唯一入口是 `src/renderer/src/api/desktop-api.ts`，业务代码禁止直接访问 `window.electronAPI`。

### IPC 响应格式

```typescript
type IpcResult<T> =
  | { ok: true; data: T; traceId: string }
  | { ok: false; error: string; traceId: string }
```

### 账单导入

支付宝 CSV 与微信 XLSX 均采用草稿式导入：`文件解析 → 内存草稿 → 分类/账户映射 → 明细复核 → 单事务确认入库`。
解析和草稿编辑阶段不写业务表；草稿绑定当前用户和渲染进程，使用 revision 防止并发覆盖，并在过期后自动释放。
确认时统一校验账户、分类及用户归属，通过 `transaction_import_refs` 按渠道交易号防止重复导入。

### Drizzle ORM

- **驱动方案**：`drizzle-orm/better-sqlite3`，同步事务保证多语句原子性。
- **schema 定义**：`src/main/database/drizzle/schema.ts`，**12 张表**。
- **service 层**：查询优先使用 Drizzle；关键多语句写操作使用同一原生事务。
- **`sqliteTable` 额外配置**：第三个参数必须返回数组 `(t) => [index(...), uniqueIndex(...)]`，不是对象（Drizzle v0.45）。

### 数据库

- 驱动：`better-sqlite3`，安装后由 `electron-builder install-app-deps` 重建 Electron ABI。
- 数据库文件：开发 `bibi-dev.db`，生产 `%APPDATA%/笔笔/bibi.db`。
- 连接配置：`PRAGMA journal_mode = WAL`、`PRAGMA foreign_keys = ON`、busy timeout 5000ms。
- 单实例锁防止多个主进程同时写同一数据库。
- 金额统一以**分（cents）**存储，界面 ÷100。
- 流水**软删除**（`is_deleted` 标志位）。
- 转账：单条流水记录同时保存转出账户与转入账户。

### 迁移工作流

```bash
# 1. 修改 drizzle/schema.ts
# 2. 生成迁移 SQL
npx drizzle-kit generate
# 3. 构建（copyMigrationPlugin 自动复制 SQL 到 out/）
npm run build
# 4. 应用启动时 runMigrations() 自动执行未应用的迁移 SQL
```

- 迁移运行器：`src/main/database/drizzle/migrations/index.ts`，追踪 `__drizzle_migrations` 表。
- 每个迁移文件在独立 SQLite 事务中执行，失败会回滚并阻止应用启动。
- 包含**旧数据库兼容逻辑**：若目标表结构已存在，则直接标记迁移已应用，避免重复建表。
- `asar: true`：`better-sqlite3` 通过 `asarUnpack` 解包；迁移 SQL 由构建插件复制到 `out/`。

### 路由与登录

- hash 路由（`createWebHashHistory`），所有页面懒加载。
- 登录页 `/login` 为独立顶层路由，主应用为 `/` 的嵌套路由。
- `router.beforeEach`：无 `currentUserId` 时重定向到 `/login`。
- `main.ts` → `bootstrapRenderer()` 读取上次登录用户，有 `currentUserId` 时跳过登录页。
- 侧栏用户区域跳转 `/login?switch=1` → 登录页检查 `?switch` 参数，仅携带此参数时不自动登录。

### 数据刷新总线

`useRefreshBus.ts` 提供发布-订阅：`emitRefresh('transaction')` → 各页面 `onRefresh('transaction', cb)` 自动重载。
事件类型：`transaction | account | category | budget | import | agent`。

### Agent 与 AI

- 入口：`src/main/agent/orchestrator.ts` 的 `processMessage()`。
- 消息模型：每一轮产生 `user → (tool × N) → assistant` 序列。
- 事件流顺序：`thinking → (tool_called → tool_result)* → chunk* → done`。
- 5 个内置 Skill：`data-query`、`calculator`、`report`、`analysis`、`transaction-write`。
- 自定义 Skill：存储为 `userData/skills/<name>.json`，仅包含 markdown 描述，无自定义工具。
- MCP：通过设置配置 MCP 服务器，运行时动态连接并加载工具。
- STT：`src/main/services/stt.service.ts` 使用 `@huggingface/transformers`，模型缓存目录为 `stt-cache/`。

### 安全

- `src/main/windows/web-security.ts` 配置 CSP、限制 `window.open`、仅允许主框架的音频权限。
- `src/shared/security/url.ts` 统一校验外部 URL，禁止非 http/https 协议。
- 主窗口：`frame: false`，`contextIsolation: true`，`sandbox: true`，`nodeIntegration: false`。

### 设计系统

- CSS 变量 `--bb-*` 在 `base.css`，UI 组件类 `bb-*` 在 `ui.css`。
- 组件库：`src/renderer/src/components/ui/`（BbSelect、BbModal、BbDatePicker、BbPopconfirm、BbCascader、BbInput、BbButton、BbSwitch、BbTabs、BbToast + Message）。
- 无标题栏窗口：`WindowControls.vue`，IPC `window:minimize/maximize/close`。

### Store 缓存与切换用户

`category.store.ts` 有 `loaded` 标志位，首次加载后缓存。
切换用户由 `resetUserData()` 统一清空所有用户域 Store，并递增请求代次，阻止旧用户的在途请求回写新会话。

## 关键命令

```bash
# 开发
npm run dev              # electron-vite dev（自动打开 DevTools）
npm run start            # electron-vite preview，预览生产构建

# 代码质量（按此顺序执行）
npm run format           # Prettier 全量格式化
npm run format:check     # Prettier 检查
npm run lint             # ESLint（flat config，--cache）
npm run typecheck:node   # tsc --noEmit -p tsconfig.node.json
npm run typecheck:web    # vue-tsc --noEmit -p tsconfig.web.json
npm run typecheck        # 以上两项顺序执行
npm run test             # 纯 TypeScript 单元测试
npm run test:db          # Electron ABI 数据库集成测试
npm run test:watch       # vitest watch 模式（单元测试）
npm run check            # format:check + lint --max-warnings=0 + typecheck + test + test:db

# 构建与打包
npm run icons            # 从 resources/icon.png 生成 build/ 图标
npm run build            # icons + check + electron-vite build（不含打包）
npm run build:unpack     # build + electron-builder --dir
npm run build:win        # icons + check + build + clean-onnxruntime + electron-builder --win
npm run build:mac        # macOS 打包
npm run build:linux      # Linux 打包
```

### 命令顺序与约束

- `npm run check` 是完整质量门禁，5 步顺序执行：格式 → lint（0 warning）→ 类型检查 → 单元测试 → 集成测试。
- `typecheck` 必须先 `tsc` 再 `vue-tsc`，两者共用 `node_modules/.cache/typescript/` 输出声明文件。
- `build:win` 在 `electron-vite build` 之后、打包之前执行 `clean-onnxruntime.mjs`，移除约 210MB 非当前平台 ONNX 二进制。
- `postinstall` 自动重建 `better-sqlite3` 为 Electron ABI，并执行 ONNX 清理。

## 类型与构建配置

- 根 `tsconfig.json` 是 project references 壳，本身不编译；真实编译由 `tsconfig.node.json` 和 `tsconfig.web.json` 完成。
- `tsconfig.node.json` 覆盖 `src/main`、`src/preload`、`src/shared`，别名 `@shared/*`。
- `tsconfig.web.json` 覆盖 `src/renderer/src`、`src/preload/*.d.ts`、`src/shared`，别名 `@renderer/*` 和 `@shared/*`。
- `electron.vite.config.ts` 中三个 target 的 alias 必须与 tsconfig 保持一致。
- `emitDeclarationOnly: true`：TS 仅输出 `.d.ts`，实际打包由 Vite 完成。
- ESLint 忽略 `scripts/` 目录；修改脚本时不会被 lint。

## 测试

- 框架：Vitest 4.x。
- 单元测试：`tests/unit/**/*.test.ts`，纯 TypeScript，可独立运行。
- 集成测试：`tests/integration/**/*.test.ts`，**必须使用 `npm run test:db`**。
- `test:db` 原理：`cross-env ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts`。
- 集成测试配置：`pool: 'forks'`、`fileParallelism: false`、`maxWorkers: 1`，保证串行执行和 SQLite 状态稳定。
- **禁止**用宿主 Node.js 直接运行数据库集成测试；`better-sqlite3` 已针对 Electron ABI 构建。

## 编码规范

- 注释使用中文，行注释单独占一行，禁止尾行注释。
- JSDoc 包含 `@author xiangwei`。
- 缩进 4 空格，单引号，无分号，printWidth 100，无尾逗号（Prettier）。
- Vue SFC `<script lang="ts">` 必须声明 TypeScript（ESLint 强制）。
- 组件名允许单字词（`vue/multi-word-component-names` 关闭）。
- 可选 prop 不需要写默认值（`vue/require-default-prop` 关闭）。
- 避免魔法数字/字符串，使用常量或枚举。
- 不允许 TS 全路径引用类型，必须 import。
- service 抛出领域异常；仅 `handle-ipc.ts` 负责统一转换为 `IpcResult`。

## 注意事项

- **没有 CI**：无 GitHub Actions。
- `.npmrc`：Electron 镜像已配置为 npmmirror.com（国内用户）。
- 预设分类在 `presets.ts`：10 个支出 + 5 个收入，含二级分类，幂等写入。
- 错误处理：渲染进程用 `Message.warning/error/success`（UI 组件库），主进程返回 `IpcResult`。
- `resources/icon.png` 必须存在才能执行 `npm run icons` 或任何 build 命令。
- 开发时数据库 `bibi-dev.db`、日志 `logs/`、STT 缓存 `stt-cache/`、自定义 Skill `skills/`、会话文件 `last-user.json` 均会被 `.gitignore` 忽略。
- 打包时 `electron-builder.yml` 会排除上述开发目录以及 `src/`、`scripts/`、测试、配置文件等。
- 开发ui时要注意跟现在的ui风格保持一致
