# 笔笔

基于 Electron、Vue 3、TypeScript、Drizzle ORM 与 SQLite 的个人记账桌面应用。

## 开发环境

- Node.js 22
- npm
- Windows 10/11（当前已验证平台）

首次安装依赖时会通过 electron-builder 将 `better-sqlite3` 重建为当前 Electron ABI：

```bash
npm install
```

## 常用命令

```bash
npm run dev          # 启动开发模式
npm run check        # 格式、lint、类型检查和全部测试
npm run test         # 纯 TypeScript 单元测试
npm run test:db      # Electron ABI 数据库集成测试
npm run build        # 生产构建
npm run build:unpack # 生成 unpacked 应用
npm run build:win    # 生成 Windows 安装包
```

不要直接使用宿主 Node.js 运行数据库集成测试。`better-sqlite3` 已针对 Electron ABI 构建，数据库测试必须使用 `npm run test:db`。

## 进程边界

```text
renderer -> desktopApi -> preload/contextBridge -> IPC -> service -> Drizzle -> better-sqlite3
```

- `src/main/app`：应用启动与生命周期编排
- `src/main/windows`：窗口创建和 Web 安全策略
- `src/main/ipc`：可信来源校验、Zod 参数校验与统一异常映射
- `src/main/services`：领域逻辑和事务化写操作
- `src/main/database`：连接、schema、迁移和预设数据
- `src/preload`：最小化桌面能力桥接
- `src/shared`：三进程共享 IPC 频道、DTO 和 API 契约
- `src/renderer/src/api`：渲染进程唯一桌面 API 适配入口

## 数据库迁移

```bash
# 1. 修改 schema
# 2. 生成迁移
npx drizzle-kit generate
# 3. 执行质量门禁和构建
npm run build
```

应用启动时会按文件名顺序执行未应用的迁移。每个迁移文件在独立 SQLite 事务中执行，失败会回滚并阻止应用继续启动。
