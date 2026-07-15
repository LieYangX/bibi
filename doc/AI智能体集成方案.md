# AI 智能体集成方案

> 笔笔个人记账桌面应用 · Skill 驱动架构（基于 Vercel AI SDK）
> 版本：v3.0 · 2026-07-12

---

## 目录

1. [概述](#1-概述)
2. [Skill 驱动架构总览](#2-skill-驱动架构总览)
3. [基于 AI SDK 的核心设计](#3-基于-ai-sdk-的核心设计)
4. [系统内置 Skills](#4-系统内置-skills)
5. [数据查询能力设计](#5-数据查询能力设计)
6. [计算工具设计](#6-计算工具设计)
7. [记忆系统设计](#7-记忆系统设计)
8. [Skill 管理与用户自定义](#8-skill-管理与用户自定义)
9. [UI 设计](#9-ui-设计)
10. [跨用户设计](#10-跨用户设计)
11. [技术方案与依赖](#11-技术方案与依赖)
12. [实现路线图](#12-实现路线图)

---

## 1. 概述

### 1.1 目标

在笔笔桌面应用中集成 AI 智能体，采用 **Skill 驱动架构 + Vercel AI SDK**，使用户通过自然语言与记账数据交互。

### 1.2 核心设计原则

| 原则            | 说明                                                                            |
| --------------- | ------------------------------------------------------------------------------- |
| **基于 AI SDK** | 使用 Vercel AI SDK 作为 LLM 交互层，利用其工具调用、流式输出、多步 agent 等能力 |
| **Skill 驱动**  | 智能体的能力由一组 Skill 定义，每个 Skill 有名称、描述、工具集                  |
| **模型选择**    | LLM 根据用户问题在所有 Skill 描述中选择最合适的 Skill                           |
| **两轮加载**    | 先给 LLM 看 Skill 描述列表，选中后全量加载该 Skill 的完整内容                   |
| **模块化工具**  | 每个 Skill 包含多个 Tool，使用 AI SDK 的 `tool()` 函数定义                      |
| **用户可扩展**  | 用户可新增自定义 Skill，系统自动注册                                            |
| **精确计算**    | 所有数字计算由专用计算工具执行，不依赖 LLM 的数学能力                           |
| **过程可见**    | UI 展示 LLM 的思考过程、选用的 Skill 和 Tool                                    |
| **用户边界**    | 所有数据查询严格限定在当前用户范围内                                            |

### 1.3 使用 AI SDK 的原因

| 能力              | AI SDK 方案                      | 自行实现的问题                    |
| ----------------- | -------------------------------- | --------------------------------- |
| **DeepSeek 支持** | `@ai-sdk/deepseek` 官方 provider | 需要自己封装 API、处理认证、重试  |
| **工具调用**      | `tool()` + Zod Schema 原生支持   | 需要自己解析 tool calls、匹配参数 |
| **多步 agent**    | `maxSteps` / 手动 agent loop     | 需要自己实现循环逻辑              |
| **流式输出**      | `streamText` + `textStream`      | 需要自己处理 SSE 或 chunk 拼接    |
| **多 provider**   | `createOpenAICompatible()` 通用  | 切换模型需要重写适配层            |
| **错误处理**      | 内置错误类型和重试机制           | 需要自己逐层 try-catch            |

---

## 2. Skill 驱动架构总览

### 2.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                        渲染进程 (Renderer)                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    AgentChatView.vue                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │  对话消息流    │  │  Thinking   │  │  Skill/Tool  │  │   │
│  │  │  (Markdown)   │  │  面板(推理)  │  │  使用记录面板  │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  可用 Skills 面板（展示当前注册的所有 Skill）      │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         │ desktopApi.agent.*                     │
├─────────────────────────┼────────────────────────────────────────┤
│               preload / contextBridge                            │
├─────────────────────────┼────────────────────────────────────────┤
│                    主进程 (Main Process)                          │
│                                                                    │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │             AI SDK Core (ai 包)                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  streamText()  ← 统一的 LLM 调用入口              │   │   │
│  │  │  tool()         ← 工具定义                        │   │   │
│  │  │  generateText() ← 非流式调用                     │   │   │
│  │  │  DeepSeekProvider ← @ai-sdk/deepseek              │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │              Agent 编排层（调用 AI SDK）                   │   │
│  │                                                          │   │
│  │  1. 接收用户消息                                          │   │
│  │  2. 构建 System Prompt + 消息列表                         │   │
│  │  3. streamText() → 流式获取 LLM 回复                      │   │
│  │     AI SDK 自动处理 tool call → 执行工具 → 继续循环       │   │
│  │  4. 流式输出通过 IPC 推送到渲染进程                         │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Skill        │  │ Tool         │  │ Context       │  │   │
│  │  │ Registry     │  │ Definitions  │  │ Builder       │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ Memory       │  │ Calculator   │  │ DB Query      │  │   │
│  │  │ Manager      │  │ Tools        │  │ Tools         │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │              Skills 目录                                  │   │
│  │  data-query/ calculator/ report/ analysis/ user-skills/  │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                         │                                       │
│  ┌──────────────────────┴──────────────────────────────────┐   │
│  │          现有 Service 层 + Drizzle ORM + SQLite           │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 AI SDK 处理流程（核心）

```
用户输入 → Agent 编排器
  │
  ├─ 构建消息数组: [System Prompt, 历史消息..., 用户输入]
  │
  ├─ 调用 streamText({
  │     model: deepSeek('deepseek-chat'),
  │     messages,
  │     tools: {
  │       query_monthly_summary: tool({...}),
  │       evaluate: tool({...}),
  │       ...
  │     },
  │     maxSteps: 10,          // AI SDK 自动处理多轮 tool call
  │     onStepFinish: step => { // 每个步骤完成后记录
  │       transmitEvent('tool_used', step.toolCalls)
  │     }
  │   })
  │
  ├─ 遍历 result.textStream:
  │     textPart → IPC 推送到渲染进程
  │
  ├─ 遍历 result.steps:
  │     记录每个步骤的 tool calls 和结果
  │
  └─ 保存完整对话历史到数据库
```

**关键优势**：AI SDK 自动处理了以下复杂流程：

- LLM 返回 tool call → 执行工具 → 结果返回 LLM → LLM 继续生成
- 多步 agent 循环（`maxSteps`）
- 流式文本输出
- 工具参数解析和类型校验（Zod）

---

## 3. 基于 AI SDK 的核心设计

### 3.1 依赖方案

```json
{
    "dependencies": {
        "ai": "^7.0.0",
        "@ai-sdk/deepseek": "^2.0.0",
        "zod": "^4.4.3" // 已有，AI SDK 使用 Zod 定义工具参数
    }
}
```

**不需要** `openai` 包，AI SDK 通过 provider 模式封装了所有底层细节。

### 3.2 DeepSeek Provider 配置

```typescript
// src/main/agent/llm-gateway.ts
import { deepSeek } from '@ai-sdk/deepseek'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

// 方案 A：使用官方 provider（推荐）
const model = deepSeek('deepseek-chat')

// 方案 B：使用自定义 baseURL（备用，如使用代理）
const customProvider = createOpenAICompatible({
    baseURL: 'https://api.deepseek.com/v1',
    name: 'deepseek-custom'
})
const model = customProvider.chatModel('deepseek-chat')

// 支持流式
const result = streamText({
    model,
    messages,
    tools,
    maxSteps: 10
})
```

### 3.3 工具定义模式

每个工具使用 AI SDK 的 `tool()` 函数 + Zod Schema：

```typescript
// src/main/agent/skills/data-query/tools/query-monthly-summary.ts
import { tool } from 'ai'
import { z } from 'zod'
import { getMonthlyStatistics } from '../../../../services/statistics.service'

export const queryMonthlySummaryTool = tool({
    description: '获取指定月份的收支汇总，包含总收入、总支出、分类占比',
    inputSchema: z.object({
        year: z.number().describe('年份，如 2026'),
        month: z.number().min(1).max(12).describe('月份，1-12')
    }),
    execute: async ({ year, month }, options) => {
        // options 包含 toolCallId，可用于追踪
        const userId = getCurrentUserId() // 从 session 获取当前用户
        const data = await getMonthlyStatistics(userId, year, month)
        return formatMonthlyResult(data) // 返回结构化的 LLM 友好文本
    }
})
```

### 3.4 手动 Agent 循环（两轮 Skill 加载）

由于我们需要实现"先看描述列表 → 选中后加载完整内容"的两轮机制，使用**手动 agent loop** 模式（而非 AI SDK 内置的 `maxSteps`）：

```typescript
// src/main/agent/orchestrator.ts
import { streamText, tool } from 'ai'
import { deepSeek } from '@ai-sdk/deepseek'
import type { CoreMessage } from 'ai'

export class AgentOrchestrator {
    async processMessage(conversationId: string, userMessage: string, userId: string) {
        // 1. 获取历史
        const history = await this.memory.getHistory(conversationId)

        // 2. 构建第一轮消息（只含 Skill 描述）
        const round1Messages: CoreMessage[] = [
            { role: 'system', content: this.buildSystemPromptV1(userId) },
            ...history,
            { role: 'user', content: userMessage }
        ]

        // 3. 第一轮：LLM 选择 Skill
        const round1 = await streamText({
            model: deepSeek('deepseek-chat'),
            messages: round1Messages
            // 不需要 tools，只让 LLM 分析需要哪个 Skill
        })

        const round1Text = await round1.text
        const selectedSkill = this.detectSkillChoice(round1Text)

        // 4. 如果选择了 Skill，加载完整内容
        if (selectedSkill) {
            const skillContent = this.skillRegistry.loadSkillContent(selectedSkill)
            this.transmitEvent({ type: 'skill_selected', skillName: selectedSkill })

            // 第二轮：加载 Skill 后，带上所有工具
            const round2Messages: CoreMessage[] = [
                {
                    role: 'system',
                    content: this.buildSystemPromptV2(userId, selectedSkill, skillContent)
                },
                ...history,
                { role: 'assistant', content: round1Text },
                { role: 'user', content: userMessage }
            ]

            const round2 = streamText({
                model: deepSeek('deepseek-chat'),
                messages: round2Messages,
                tools: this.getToolsForSkill(selectedSkill),
                maxSteps: 10, // AI SDK 自动处理所有工具调用
                onStepFinish: (step) => {
                    // 记录每一步的 tool 使用
                    for (const toolCall of step.toolCalls ?? []) {
                        this.transmitEvent({
                            type: 'tool_called',
                            toolName: toolCall.toolName,
                            toolArgs: toolCall.args
                        })
                    }
                }
            })

            // 流式输出
            for await (const textPart of round2.textStream) {
                this.transmitEvent({ type: 'chunk', content: textPart })
            }
        } else {
            // LLM 直接回复（无需 Skill）
            for await (const textPart of round1.textStream) {
                this.transmitEvent({ type: 'chunk', content: textPart })
            }
        }

        // 5. 保存对话
        await this.saveConversation(conversationId, userId, userMessage, response)
    }
}
```

**实际实现可以更简洁**：如果 Skill 不需要动态加载（即所有 Skill 的完整内容都直接在第二轮 Prompt 中），甚至可以直接合并为一步：

```
// 简化方案（推荐第一期使用）：
// 一次性构建包含所有 Skill 完整内容的 System Prompt
// 但加上分段标记，让 LLM 优先选择

const systemPrompt = `
## 可用 Skills 及其完整指令

### Skill: data-query
${dataQuerySkillContent}

### Skill: calculator
${calculatorSkillContent}

### Skill: report
${reportSkillContent}

### Skill: analysis
${analysisSkillContent}

请先分析用户问题，选择最合适的 Skill，然后使用该 Skill 提供的工具。
如果需要计算，必须使用 calculator 的 evaluate 工具。
`

// 直接调用 AI SDK，带上所有工具
const result = streamText({
    model: deepSeek('deepseek-chat'),
    messages: [systemPrompt, ...history, userMessage],
    tools: allRegisteredTools,  // 全局注册所有工具
    maxSteps: 10,
    onStepFinish: ...
})
```

这种简化方案在第一阶段更务实，随着 Skill 数量增多再迁移到两轮加载方案。

### 3.5 流式事件推送

AI SDK 的 `streamText` 返回的 `textStream` 是 AsyncIterable，我们将其转化为 IPC 事件：

```typescript
// src/main/agent/ipc/agent.ipc.ts
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { AgentOrchestrator } from '../orchestrator'

const orchestrator = new AgentOrchestrator()

export function registerAgentIpc(): void {
    ipcMain.handle('agent:chat', async (event, conversationId, message) => {
        // 启动异步处理
        const userId = await getCurrentUserId()
        processChat(event, conversationId, message, userId).catch((error) => {
            event.sender.send('agent:chat:event', {
                type: 'error',
                error: error.message
            })
        })
        return createIpcSuccess('started')
    })
}

async function processChat(
    event: IpcMainInvokeEvent,
    conversationId: string | null,
    message: string,
    userId: string
): Promise<void> {
    const sendEvent = (data: StreamEvent) => {
        event.sender.send('agent:chat:event', data)
    }

    await orchestrator.processMessage(conversationId, message, userId, {
        transmit: sendEvent
    })

    sendEvent({ type: 'done', conversationId })
}
```

事件类型：

```typescript
// 流式事件全表
thinking_start // 开始思考
thinking: '分析用户问题...' // 思考片段
skill_selected: 'data-query' // 选择了哪个 Skill
tool_called: 'query_monthly_summary' // 调用了哪个工具（AI SDK 的 onStepFinish）
tool_result: '{...}' // 工具执行结果
chunk: '您本月...' // 流式文本片段
done // 完成
error: 'API Key...' // 错误
```

### 3.6 Tool 执行中的用户边界

AI SDK 的 `tool.execute()` 回调不直接暴露 `options` 中的 userId，但我们可以利用闭包注入：

```typescript
// 在创建工具时，通过闭包注入 userId
function createToolWithUser(toolDef: ToolDefinition, userId: string) {
    return tool({
        description: toolDef.description,
        inputSchema: toolDef.inputSchema,
        execute: async (args) => {
            return toolDef.execute(args, userId)
        }
    })
}

// 注册时包装
const toolsForLLM: Record<string, Tool> = {}
for (const [name, def] of allToolDefinitions) {
    toolsForLLM[name] = createToolWithUser(def, currentUserId)
}
```

LLM 看不到 `userId` 参数，无法越权查询。

---

## 4. 系统内置 Skills

### 4.1 data-query（数据查询 Skill）

**元数据**：

```yaml
name: data-query
displayName: 数据查询
description: 查询数据库中的流水、账户、预算、统计信息
    适合用户询问"花了多少""余额""预算情况"时使用
```

**SKILL.md 核心**：告诉 LLM 何时使用哪些数据查询工具、金额单位规范、分类类型等。

**包含的工具**（全部通过 AI SDK `tool()` 定义）：

| 工具名                      | 参数                                                              | 对应 Service        |
| --------------------------- | ----------------------------------------------------------------- | ------------------- |
| `query_monthly_summary`     | year, month                                                       | statistics.service  |
| `query_yearly_summary`      | year                                                              | statistics.service  |
| `query_transactions`        | start_date, end_date, type, category_id, keyword, page, page_size | transaction.service |
| `query_recent_transactions` | limit, type                                                       | transaction.service |
| `query_account_balance`     | (无)                                                              | account.service     |
| `query_budget_progress`     | year, month                                                       | budget.service      |
| `query_category_summary`    | start_date, end_date, type                                        | 新建聚合查询        |

### 4.2 calculator（计算 Skill）

**元数据**：

```yaml
name: calculator
displayName: 计算器
description: 执行精确的数学计算。所有涉及数字计算的任务都必须使用此 Skill
```

**SKILL.md 核心**：

```markdown
# 计算器 Skill

**必须遵守：你绝对不能自己计算任何数字。所有计算必须通过此 Skill 的工具完成。**

## 为什么

LLM 在数学计算上不可靠，尤其是多步计算、百分比、大数计算。专用计算工具保证 100% 精确。

## 使用规则

1. 所有计算都通过工具执行
2. 多步计算时，每一步单独调用 evaluate
3. 涉及百分比变化 -> compare_values
4. 数据库返回的分值 -> 先用 convert_cents_to_yuan
```

**包含的工具**：

| 工具名                  | 参数                     | 说明                             |
| ----------------------- | ------------------------ | -------------------------------- |
| `evaluate`              | expression: string       | 执行数学表达式，使用 mathjs      |
| `summarize`             | values: number[]         | 汇总统计（总和/平均/最大/最小）  |
| `compare_values`        | current, previous, label | 对比两组数据，返回变化值和百分比 |
| `convert_cents_to_yuan` | cents: number            | 将分转换为元，保留两位小数       |

**evaluate 工具的实现**：

```typescript
// src/main/agent/skills/calculator/tools/evaluate.tool.ts
import { tool } from 'ai'
import { z } from 'zod'
import { evaluate as mathEvaluate } from 'mathjs'

export const evaluateTool = tool({
    description: '执行数学表达式计算，支持加减乘除、括号、百分比、幂运算',
    inputSchema: z.object({
        expression: z
            .string()
            .describe('数学表达式，如 "1500 + 3200"、"(5230 - 3800) / 5230 * 100"')
    }),
    execute: async ({ expression }) => {
        try {
            const result = mathEvaluate(expression)
            return {
                expression,
                result,
                formatted: `${expression} = ${result}`
            }
        } catch (error) {
            return { error: `表达式无效: ${error.message}` }
        }
    }
})
```

### 4.3 report（报告生成 Skill）

**元数据**：

```yaml
name: report
displayName: 报告生成
description: 生成周报、月报、年报等结构化财务报告
    适合"给我生成报告""总结一下这周/月/年"的场景
```

**说明**：此 Skill 没有独立工具，它的 SKILL.md 指导 LLM 如何：

1. 调用 data-query 的工具获取数据
2. 调用 calculator 的工具计算指标
3. 按模板组织报告文本

### 4.4 analysis（分析 Skill）

**元数据**：

```yaml
name: analysis
displayName: 消费分析
description: 消费趋势分析、数据对比、异常检测、理财建议
    适合"分析我的消费""对比两个月""有什么异常"的场景
```

**包含的工具**：

| 工具名                      | 参数                                               | 说明             |
| --------------------------- | -------------------------------------------------- | ---------------- |
| `compare_periods`           | period1Start, period1End, period2Start, period2End | 对比两段时间收支 |
| `detect_spending_anomalies` | start_date, end_date, threshold                    | 检测异常大额支出 |
| `analyze_trend`             | start_date, end_date, granularity                  | 支出趋势分析     |

---

## 5. 数据查询能力设计

### 5.1 工具实现模式

所有数据查询工具遵循统一模式：

```typescript
// src/main/agent/skills/data-query/tools/query-monthly-summary.tool.ts
import { tool } from 'ai'
import { z } from 'zod'
import { getMonthlyStatistics } from '../../../../services/statistics.service'
import { getCurrentUserId } from '../../../../services/session.service'

export const queryMonthlySummaryTool = tool({
    description: '获取指定月份的收支汇总，包含总收入、总支出、结余、分类占比',
    inputSchema: z.object({
        year: z.number().describe('年份，如 2026'),
        month: z.number().min(1).max(12).describe('月份，1-12')
    }),
    execute: async ({ year, month }) => {
        const userId = await getCurrentUserId()
        const data = await getMonthlyStatistics(userId, year, month)

        // 转换为 LLM 友好的文本格式
        return {
            summary: {
                income: (data.total_income_cents / 100).toFixed(2),
                expense: (data.total_expense_cents / 100).toFixed(2),
                balance: (data.balance_cents / 100).toFixed(2),
                totalAssets: (data.total_balance_cents / 100).toFixed(2)
            },
            categories: data.expense_categories.map((c) => ({
                name: c.category_name,
                amount: (c.amount_cents / 100).toFixed(2),
                percentage: c.percentage
            })),
            dailyExpense: data.daily_expense.map((d) => ({
                date: d.date,
                amount: (d.amount_cents / 100).toFixed(2)
            })),
            // 纯文本版本，LLM 可直接使用
            formatted: `## ${year}年${month}月收支汇总

**总支出**: ¥${(data.total_expense_cents / 100).toFixed(2)}
**总收入**: ¥${(data.total_income_cents / 100).toFixed(2)}
**结余**: ¥${(data.balance_cents / 100).toFixed(2)}
**总资产**: ¥${(data.total_balance_cents / 100).toFixed(2)}

### 支出分类
${data.expense_categories
    .map((c) => `- ${c.category_name}: ¥${(c.amount_cents / 100).toFixed(2)} (${c.percentage}%)`)
    .join('\n')}`
        }
    }
})
```

### 5.2 用户边界

所有数据查询工具在 `execute` 内部获取 `userId`，LLM 无法传递此参数：

```typescript
execute: async (args) => {
    // userId 来自 session，不来自 LLM 参数
    const userId = await getCurrentUserId()
    if (!userId) throw new Error('请先选择用户')
    // 所有 service 层方法自动按 userId 过滤
    return serviceMethod(userId, ...args)
}
```

---

## 6. 计算工具设计

### 6.1 为什么需要独立计算工具

| 计算场景             | LLM 自行计算的错误率 | 使用工具后 |
| -------------------- | -------------------- | ---------- |
| 百分比计算 (A/B*100) | ~15%                 | 0%         |
| 多步计算             | ~30%                 | 0%         |
| 大数计算             | ~20%                 | 0%         |
| 单位换算 (分→元)     | ~10%                 | 0%         |

### 6.2 实现

```typescript
// src/main/agent/skills/calculator/tools/evaluate.tool.ts
import { tool } from 'ai'
import { z } from 'zod'
import { evaluate as mathEvaluate, create, all } from 'mathjs'

// 创建安全沙箱（禁用动态代码执行）
const math = create(all)
const limitedEvaluate = math.evaluate

export const evaluateTool = tool({
    description: '执行数学表达式计算。支持 + - * / ( ) % ^',
    inputSchema: z.object({
        expression: z.string().describe('要计算的数学表达式')
    }),
    execute: async ({ expression }) => {
        try {
            const result = limitedEvaluate(expression)
            return {
                expression,
                result: typeof result === 'number' ? result : Number(result),
                formatted: `${expression} = ${result}`
            }
        } catch (error) {
            return { error: `计算错误: ${error.message}` }
        }
    }
})
```

### 6.3 计算工具在 Skill 系统中的位置

Calculator 是一个独立 Skill，其他 Skill 的 SKILL.md 中会明确要求：

> "如果需要计算（百分比、汇总、比较等），必须使用 calculator 的 evaluate、summarize、compare_values 工具。绝对不要自己计算。"

由于 AI SDK 的所有工具都在同一平面注册，LLM 可以在执行 data-query 任务时调用 calculator 的工具。

---

## 7. 记忆系统设计

### 7.1 两层架构（不集成知识库）

```
┌─────────────────────────────────────────────────────┐
│         第一层：短期记忆（内存）                        │
│  存储：Map<conversationId, CoreMessage[]>            │
│  上限：20 轮 / ~5000 tokens                          │
│  过期：最后活跃 + 24h                                │
│  作用：维持对话上下文，传递给 AI SDK                   │
├─────────────────────────────────────────────────────┤
│         第二层：会话持久化（SQLite）                    │
│  存储：agent_conversations + agent_messages          │
│  作用：历史回顾、继续对话                              │
└─────────────────────────────────────────────────────┘
```

### 7.2 AI SDK 消息格式适配

AI SDK 使用 `CoreMessage` 格式，我们需要在存储中保持兼容：

```typescript
// AI SDK 的消息格式
import type { CoreMessage } from 'ai'

// 存储时直接存 CoreMessage 的 JSON 序列化
// 这样取出后可以直接传给 AI SDK 的 streamText()

// 存储到 SQLite 的格式
interface StoredMessage {
    id: string
    conversation_id: string
    role: string
    content: string // CoreMessage content 的 JSON
    // 附加元数据（非 AI SDK 标准字段）
    skill_used?: string
    tool_used?: string
    thinking?: string
    token_count?: number
    created_at: string
}

// 从存储恢复为 CoreMessage
function toCoreMessage(stored: StoredMessage): CoreMessage {
    return {
        role: stored.role as CoreMessage['role'],
        content: JSON.parse(stored.content)
    }
}
```

### 7.3 数据库表结构

```typescript
// schema.ts 新增
export const agentConversations = sqliteTable(
    'agent_conversations',
    {
        id: text('id').primaryKey(),
        user_id: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        title: text('title').notNull().default('新对话'),
        message_count: integer('message_count').notNull().default(0),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_agent_conversations_user').on(table.user_id)]
)

export const agentMessages = sqliteTable(
    'agent_messages',
    {
        id: text('id').primaryKey(),
        conversation_id: text('conversation_id')
            .notNull()
            .references(() => agentConversations.id, { onDelete: 'cascade' }),
        role: text('role').notNull(),
        content: text('content').notNull(),
        // AI SDK 关联信息
        tool_calls: text('tool_calls'), // JSON
        tool_results: text('tool_results'), // JSON
        finish_reason: text('finish_reason'),
        // 展示用元数据
        skill_used: text('skill_used'),
        tool_used: text('tool_used'),
        thinking: text('thinking'),
        token_count: integer('token_count'),
        created_at: text('created_at')
            .notNull()
            .default(sql`(datetime('now', 'localtime'))`)
    },
    (table) => [index('idx_agent_messages_conversation').on(table.conversation_id)]
)
```

---

## 8. Skill 管理与用户自定义

### 8.1 目录结构

```
~/.bibi/skills/                           # 用户自定义 skill 目录
    my-custom-skill/
        SKILL.md                          # Skill 元数据 + 指令
        tools/                            # 工具实现（可选）
            my-tool.ts

~/.bibi/app-data/skills/                  # 系统内置 Skill（自动安装）
    data-query/
        SKILL.md
        tools/
            query-monthly-summary.tool.ts
            query-transactions.tool.ts
            ...
    calculator/
        SKILL.md
        tools/
            evaluate.tool.ts
            summarize.tool.ts
    report/
        SKILL.md
    analysis/
        SKILL.md
        tools/
            compare-periods.tool.ts
            detect-anomalies.tool.ts
```

### 8.2 用户自定义 Skill

最简单的自定义 Skill——纯指令型（无需编写 JavaScript）：

```markdown
# ~/.bibi/skills/holiday-budget/SKILL.md

---

name: holiday-budget
displayName: 节假日预算
description: 帮助用户规划节假日期间的预算，基于历史记账数据给出建议
version: 1.0
author: user
---

# 节假日预算 Skill

你是一个节假日预算规划专家。

## 工作流程

1. 询问用户的节假日预算总额
2. 查询去年同期的消费数据（调用 data-query 的 query_monthly_summary）
3. 参考历史支出分类给出预算分配建议
4. 所有计算使用 calculator skill

## 输出格式

- 总预算: XXXX 元
- 建议分配: 餐饮 XX%, 交通 XX%, ...
- 与去年对比: ...
```

带 JavaScript 工具的自定义 Skill：

```markdown
# ~/.bibi/skills/savings-goal/SKILL.md

---

name: savings-goal
displayName: 储蓄目标
description: 帮助用户设定和跟踪储蓄目标
version: 1.0
tools:

- name: calculate_savings_plan
  description: 计算达成储蓄目标所需的时间
  inputSchema:
  targetAmount: number
  currentSavings: number
  monthlyIncome: number
  monthlyExpense: number

---
```

对应工具实现：

```typescript
// ~/.bibi/skills/savings-goal/tools/calculate-savings-plan.tool.ts
import { tool } from 'ai'
import { z } from 'zod'

export const calculateSavingsPlanTool = tool({
    name: 'calculate_savings_plan',
    description: '计算达成储蓄目标所需的每月储蓄额和时间',
    inputSchema: z.object({
        targetAmount: z.number(),
        currentSavings: z.number(),
        monthlyIncome: z.number(),
        monthlyExpense: z.number()
    }),
    execute: async (args) => {
        const monthlySavable = args.monthlyIncome - args.monthlyExpense
        const remaining = args.targetAmount - args.currentSavings
        const monthsNeeded = Math.ceil(remaining / monthlySavable)
        return {
            monthlySavable,
            remaining,
            monthsNeeded,
            feasible: monthlySavable > 0
        }
    }
})
```

### 8.3 加载机制

```typescript
class SkillRegistry {
    async loadAllSkills(): Promise<Map<string, SkillDefinition>> {
        const skills = new Map()

        // 加载内置 skill
        await this.loadFromDir(join(appDataPath, 'skills'), skills, true)

        // 加载用户自定义 skill
        await this.loadFromDir(join(userDataPath, 'skills'), skills, false)

        return skills
    }

    private async loadFromDir(
        dir: string,
        skills: Map<string, SkillDefinition>,
        isSystem: boolean
    ) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue
            const skillPath = join(dir, entry.name)
            const meta = parseSkillMeta(join(skillPath, 'SKILL.md'))
            if (!meta) continue

            const tools: Record<string, Tool> = {}
            const toolsDir = join(skillPath, 'tools')
            if (existsSync(toolsDir)) {
                for (const f of readdirSync(toolsDir).filter(
                    (f) => f.endsWith('.tool.ts') || f.endsWith('.tool.js')
                )) {
                    const mod = await import(join(toolsDir, f))
                    Object.assign(tools, mod)
                }
            }

            skills.set(meta.name, { meta, tools, isSystem })
        }
    }
}
```

### 8.4 Skill 管理 UI

在设置页面的"智能体"板块集成：

```
设置 → 智能体
  ├── 基本配置
  │   ├── API Key:  [················]
  │   ├── 模型:     [deepseek-chat ▼]
  │   └── 启用智能体 [✅]
  │
  └── Skill 管理
      ├── 系统内置（只读）
      │   ├── 数据查询    ✅ 已启用  9 个工具
      │   ├── 计算器      ✅ 已启用  4 个工具
      │   ├── 报告生成    ✅ 已启用  无独立工具
      │   └── 消费分析    ✅ 已启用  3 个工具
      │
      ├── 自定义
      │   ├── 节假日预算  ✅ 已启用  无独立工具
      │   └── 储蓄目标    ❌ 已禁用  1 个工具
      │
      └── [添加自定义 Skill] → 选择包含 SKILL.md 的目录
          [刷新所有 Skill]
```

---

## 9. UI 设计

### 9.1 页面布局

```
┌──────────────────────────────────────────────────────┐
│  ← 返回    🤖 智能体助手                [⚙ 设置]    │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ 可用     │  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│ Skills   │   🤔 正在分析问题...                    │   │
│          │  │ 用户询问当月支出，                  │   │
│ data-    │  │ data-query 最适合...               │   │
│ query ✅ │  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│ calc   ✅│                                           │
│ report ✅│  ┌─────────────────────────────────────┐  │
│ analy  ✅│  │ 💡 Skill: 数据查询                 │  │
│          │  │ 🔧 工具: query_monthly_summary     │  │
│ ─ ─ ─ ─ │  │ 📋 参数: 2026年7月                 │  │
│          │  └─────────────────────────────────────┘  │
│ 快捷提问 │                                           │
│  · 我这个│  ┌─────────────────────────────────────┐  │
│    月花  │  │ 您本月总支出为 **5,230 元**，       │  │
│    了多  │  │ 共收入 **8,000 元**。               │  │
│    少？  │  │                                     │  │
│  · 余额  │  │ 📊 主要支出类别：                    │  │
│    还有  │  │ - 餐饮: 1,800 元 (34.4%)           │  │
│    多少？│  │ - 交通: 650 元 (12.4%)             │  │
│  · 预算  │  │ - 购物: 580 元 (11.1%)             │  │
│    进度  │  └─────────────────────────────────────┘  │
│          │                                           │
│          │  ┌─────────────────────────────────────┐  │
│          │  │ 输入消息...                    [发送]│  │
├──────────┴───────────────────────────────────────────┤
│  共 3 条对话  |  Token: 1,234                       │
└──────────────────────────────────────────────────────┘
```

**左侧面板（SkillPanel.vue）**：

- 当前注册的所有 Skill 列表
- 状态标识：✅ 已启用 / ❌ 已禁用
- 快捷提问按钮

**消息组件（AgentMessage.vue）**：
每条 AI 消息展示三个区域：

1. **思考过程**（可折叠）：
    - 显示 AI 的推理过程（`thinking` 字段）
    - 灰色背景，折叠状态默认收起

2. **Skill/Tool 使用记录**：

    ```html
    💡 使用的 Skill: 数据查询 🔧 使用的工具: query_monthly_summary 📋 参数: {year: 2026, month: 7}
    📊 查询结果: 总支出 5,230 元 ...
    ```

3. **回答内容**：
    - Markdown 渲染
    - 表格样式统一
    - 金额数字高亮

### 9.2 路由

```typescript
// router/index.ts 新增
{
    path: '/',
    component: AppLayout,
    children: [
        // ... 现有路由
        {
            path: 'agent',
            name: 'Agent',
            component: () => import('../views/AgentChatView.vue')
        }
    ]
}
```

侧栏新增导航：

```typescript
{ path: '/agent', label: '智能体', icon: Bot }
// 使用 lucide 的 Bot 图标
```

---

## 10. 跨用户设计

| 维度             | 设计                                                 |
| ---------------- | ---------------------------------------------------- |
| **对话数据**     | `agent_conversations.user_id` 字段隔离，外键级联删除 |
| **短期记忆**     | `userId:conversationId` 复合 Key                     |
| **Tool 执行**    | `execute` 内部通过 `getCurrentUserId()` 获取用户     |
| **API Key**      | 应用级全局配置（settings 表）                        |
| **自定义 Skill** | 文件系统，所有用户共享                               |
| **切换用户**     | 清空短期记忆，重载对话列表                           |

---

## 11. 技术方案与依赖

### 11.1 新增依赖

| 包名                 | 用途                         | 类型         | 理由                                     |
| -------------------- | ---------------------------- | ------------ | ---------------------------------------- |
| `ai` (Vercel AI SDK) | LLM 调用、工具调用、流式输出 | dependencies | 统一 API，内置 tool calling + 多步 agent |
| `@ai-sdk/deepseek`   | DeepSeek provider            | dependencies | 官方 DeepSeek 支持                       |
| `mathjs`             | 精确数学计算                 | dependencies | 沙箱化表达式求值                         |
| `marked`             | Markdown 渲染                | dependencies | 消息内容展示                             |

**不引入**的依赖：

- `openai` → AI SDK 已封装
- `zod` → 项目中已有
- `highlight.js` → 可选，后期按需

### 11.2 新增文件清单

```
~/.bibi/skills/                         # 用户自定义 skill 目录（运行时创建）

src/
  main/
    agent/
      index.ts
      orchestrator.ts                   # Agent 编排器（调用 AI SDK）
      llm-gateway.ts                    # LLM 配置（DeepSeek provider）
      skill-registry.ts                 # Skill 注册与加载
      tool-loader.ts                    # 从文件系统加载工具
      context-builder.ts                # System Prompt 构建
      skills/
        data-query/
          SKILL.md
          index.ts                      # 导出所有工具
          tools/
            query-monthly-summary.tool.ts
            query-yearly-summary.tool.ts
            query-transactions.tool.ts
            query-recent-transactions.tool.ts
            query-account-balance.tool.ts
            query-budget-progress.tool.ts
            query-category-summary.tool.ts
        calculator/
          SKILL.md
          index.ts
          tools/
            evaluate.tool.ts               # mathjs 实现
            summarize.tool.ts
            compare-values.tool.ts
            convert-cents-to-yuan.tool.ts
        report/
          SKILL.md
          index.ts
        analysis/
          SKILL.md
          index.ts
          tools/
            compare-periods.tool.ts
            detect-anomalies.tool.ts
            analyze-trend.tool.ts
      memory/
        index.ts
        short-term.ts
        conversation-store.ts
      ipc/
        agent.ipc.ts
    database/drizzle/
      schema.ts                         # 追加 agent_conversations, agent_messages
      migrations/
  shared/
    ipc/
      channels.ts                       # 追加 agent 频道常量
      schemas.ts                        # 追加 Zod 校验规则
    types/
      agent.ts                          # 智能体类型定义
      electron-api.ts                   # 追加 agent API 声明
  preload/
    index.ts                            # 追加 agent API
  renderer/
    src/
      router/index.ts                   # 追加 /agent 路由
      views/
        AgentChatView.vue
        sections/
          AgentSettings.vue
          SkillManagement.vue
      components/
        AgentMessage.vue                # 消息组件（含 thinking/usage）
        SkillPanel.vue                  # Skill 列表面板
      stores/
        agent.store.ts
      assets/
        agent.css
```

### 11.3 核心类型定义

```typescript
// src/shared/types/agent.ts

import type { Tool } from 'ai'

// ========== Skill 相关 ==========

export interface SkillMeta {
    name: string
    displayName: string
    description: string
    version: string
    author?: string
    isSystem?: boolean
    isEnabled?: boolean
    toolCount: number
}

export interface SkillDefinition {
    meta: SkillMeta
    markdown: string // SKILL.md 全文
    tools: Record<string, Tool> // AI SDK tool 对象
    isSystem: boolean
}

// ========== 对话相关 ==========

export interface AgentConfig {
    apiKey: string
    model: string
    temperature: number
    maxTokens: number
    enabled: boolean
}

export interface Conversation {
    id: string
    user_id: string
    title: string
    message_count: number
    created_at: string
    updated_at: string
}

export interface ConversationListItem {
    id: string
    title: string
    message_count: number
    last_message: string | null
    updated_at: string
}

// ========== 流式事件 ==========

export type StreamEventType =
    'thinking' | 'skill_selected' | 'tool_called' | 'tool_result' | 'chunk' | 'done' | 'error'

export interface StreamEvent {
    type: StreamEventType
    content?: string
    skillName?: string
    displayName?: string
    toolName?: string
    toolArgs?: Record<string, unknown>
    toolResult?: unknown
    conversationId?: string
    error?: string
}

// ========== Agent API ==========

export interface AgentAPI {
    chat: (conversationId: string | null, message: string) => Promise<IpcResult<string>>
    cancelChat: () => Promise<IpcResult>
    listConversations: () => Promise<IpcResult<ConversationListItem[]>>
    deleteConversation: (id: string) => Promise<IpcResult>
    getConversation: (id: string) => Promise<IpcResult>
    getConfig: () => Promise<IpcResult<AgentConfig>>
    updateConfig: (config: Partial<AgentConfig>) => Promise<IpcResult>
    listSkills: () => Promise<IpcResult<SkillMeta[]>>
    reloadSkills: () => Promise<IpcResult>
    toggleSkill: (name: string, enabled: boolean) => Promise<IpcResult>
}
```

---

## 12. 实现路线图

### 第一阶段：核心架构 + data-query + calculator（MVP）— 3-4 周

| 步骤 | 任务                                         | 涉及文件                                |
| ---- | -------------------------------------------- | --------------------------------------- |
| 1    | 安装 `ai` + `@ai-sdk/deepseek` + `mathjs`    | package.json                            |
| 2    | 新增数据库表 + 迁移                          | schema.ts、迁移 SQL                     |
| 3    | 定义共享类型                                 | shared/types/agent.ts                   |
| 4    | 配置 DeepSeek provider                       | main/agent/llm-gateway.ts               |
| 5    | 实现 Skill Registry（文件扫描 + 加载）       | main/agent/skill-registry.ts            |
| 6    | 实现 Tool Loader（导入 .tool.ts 文件）       | main/agent/tool-loader.ts               |
| 7    | 实现 data-query Skill（SKILL.md + 7 个工具） | skills/data-query/                      |
| 8    | 实现 calculator Skill（SKILL.md + 4 个工具） | skills/calculator/                      |
| 9    | 实现 Context Builder（System Prompt）        | main/agent/context-builder.ts           |
| 10   | 实现 Orchestrator（调用 AI SDK streamText）  | main/agent/orchestrator.ts              |
| 11   | 实现 ShortTermMemory                         | main/agent/memory/short-term.ts         |
| 12   | 实现 ConversationStore                       | main/agent/memory/conversation-store.ts |
| 13   | IPC 通道 + 流式事件推送                      | main/agent/ipc/agent.ipc.ts             |
| 14   | Preload 桥接                                 | preload/index.ts                        |
| 15   | AgentStore（Pinia）                          | stores/agent.store.ts                   |
| 16   | AgentChatView.vue                            | views/AgentChatView.vue                 |
| 17   | AgentMessage.vue（thinking + usage）         | components/AgentMessage.vue             |
| 18   | SkillPanel.vue                               | components/SkillPanel.vue               |
| 19   | AgentSettings.vue（API Key）                 | views/sections/AgentSettings.vue        |
| 20   | 路由 + 侧栏导航                              | router/index.ts、AppLayout.vue          |

### 第二阶段：报告 + 分析 — 1-2 周

| 步骤 | 任务                                   | 优先级 |
| ---- | -------------------------------------- | ------ |
| 1    | report Skill（SKILL.md + 模板）        | 高     |
| 2    | analysis Skill（对比、异常检测、趋势） | 高     |
| 3    | 会话管理 UI（历史列表）                | 高     |
| 4    | 快捷提问预设                           | 中     |
| 5    | 对话导出                               | 低     |

### 第三阶段：用户自定义 Skill — 1-2 周

| 步骤 | 任务                            | 优先级 |
| ---- | ------------------------------- | ------ |
| 1    | 用户自定义 Skill 文件扫描加载   | 高     |
| 2    | 纯指令模式（仅 SKILL.md）       | 高     |
| 3    | JavaScript 工具加载支持         | 中     |
| 4    | Skill 管理 UI（启用/禁用/详情） | 高     |
| 5    | 自定义 Skill 用户手册           | 中     |

### 第四阶段：增强优化 — 1 周

| 步骤 | 任务                        | 优先级 |
| ---- | --------------------------- | ------ |
| 1    | Token 用量统计              | 中     |
| 2    | 智能体回答反馈              | 低     |
| 3    | 模型参数调节（temperature） | 低     |

---

## 附录：关键决策记录

| 决策               | 选择                   | 理由                                                        |
| ------------------ | ---------------------- | ----------------------------------------------------------- |
| **LLM 框架**       | **Vercel AI SDK**      | 内置 tool calling、多步 agent、流式、DeepSeek 官方 provider |
| **架构**           | Skill 驱动（两轮加载） | 按需加载 Skill 内容，降低每次调用的 token 消耗              |
| **知识库**         | **不集成**             | 数据高度结构化，SQL 比 RAG 更精确                           |
| **计算**           | mathjs 沙箱            | 100% 精确，不依赖 LLM                                       |
| **Skill 存储**     | 文件系统               | 用户可直接编辑，易于理解                                    |
| **流式**           | IPC send               | 与现有架构一致                                              |
| **用户自定 Skill** | SKILL.md + .tool.ts    | 简单场景纯 Markdown，复杂场景可写工具                       |
