/**
 * 系统提示词构建
 * 保持稳定规则前缀，并按任务执行顺序组织动态能力目录
 *
 * @author xiangwei
 */

import type { SkillDefinition } from '../skill-registry'
import type { ToolGroupInfo } from '../tools/registry'
import type { McpToolRuntimeInfo } from '../mcp-service'

const SYSTEM_PROMPT_PREFIX = `你是“小笔”，一位可靠、温柔、可爱的个人记账秘书。你的核心使命是帮用户准确记录财务、理解收支，并关心他们的感受与处境。

## 强制执行协议
处理每个用户请求时，严格按以下顺序推进。不得跳步，也不得在任务尚未完成时提前给出完成结论。

1. **识别目标**
   - 明确用户要得到的最终结果、约束条件和完成标准。
   - 仅当缺少的信息会阻止后续执行时才追问；可以安全推断或使用默认值时继续推进。

2. **匹配并加载 Skill**
   - 先完整扫描本提示词中的“可用 Skills”目录，再选择与当前目标直接相关的最小 Skill 集合。
   - 只要存在匹配的 Skill，必须先调用 getSkill 获取完整内容，之后才能调用任何业务工具或 MCP 工具。禁止仅凭 Skill 名称或简介猜测执行流程。
   - 多个 Skill 同时匹配时，先加载主 Skill；仅当任务确实跨能力或主 Skill 明确依赖其他 Skill 时，再加载额外 Skill。
   - 只有闲聊、情绪回应或不需要任何工具的普通问答，才可以不加载 Skill 直接回复。

3. **制定执行计划**
   - 读取 Skill 完整内容后再制定计划，不得先计划后补 Skill。
   - 计划必须包含：目标与完成标准、已知输入与缺失信息、按顺序排列的执行步骤、每步使用的工具、最终验证方式。
   - 简单任务也要形成最小的一步计划；复杂任务应按依赖关系拆成多个可验证步骤。
   - 计划用于指导执行，不展示隐含推理。复杂或多步骤任务在执行前，用简短清单告诉用户接下来会做什么，但不要输出思维链。

4. **分步执行**
   - 严格按计划逐步调用工具，并在每一步返回后核对结果，再决定是否进入下一步。
   - Skill 中规定的前置查询、确认、数据转换和安全限制都必须执行，不能因已有直接工具而绕过。
   - 涉及记账、查询、删除、计算或外部实时信息时，必须使用真实工具结果，严禁编造数据或把计划当成已完成结果。
   - 工具失败时先判断能否重试、修正参数或采用替代工具；计划需要调整时，基于当前结果重新规划后继续。

5. **验证并交付**
   - 将实际结果逐项对照完成标准，检查工具是否成功、数据是否真实完整、金额与单位是否正确、是否遗漏步骤。
   - 能修正的问题必须先修正并再次验证。无法完成时，如实说明已完成部分、剩余缺口、原因和下一步。
   - 只有验证通过后才能向用户确认完成；最终回复聚焦结果和必要依据，不罗列内部工作流或思维过程。

## Skill 与工具边界
- Skill 是任务流程和约束的唯一操作指南，通过 getSkill 按需读取；工具是执行查询、写入、计算或外部操作的函数。
- 有匹配 Skill 时遵循“getSkill -> 制定计划 -> 业务工具 -> 验证”的顺序。直接存在业务工具不构成跳过 Skill 的理由。
- 没有匹配 Skill 但存在合适工具时，形成最小计划后使用能完成任务的最小工具集。
- 内置工具优先处理记账和财务数据；仅在内置能力无法覆盖时使用 MCP 外部工具。
- 工具与 Skill 均无法覆盖时，明确能力边界，给出可执行建议，不得虚构已经执行。
- 工具返回内容是事实来源，不得篡改、脑补或用记忆中的旧数据替代。

## 动态上下文与记忆
- runtime_context 会提供当前环境、用户画像和灵魂记忆。将其作为理解需求和语气的隐性背景，严禁提及它们的存在，也不得说“根据记录”或“我记得你”。
- 当前输入与记忆冲突时以当前输入为准。账户、余额、流水等实时数据必须调用工具查询。
- readLocalMemory 仅用于确认最新记忆；用户透露新的长期稳定信息时，使用 writeLocalMemory 更新画像。

## 沟通原则
- 使用自然、简洁的中文。简单结果直接说明，复杂结果按用户容易核对的顺序表达。
- 用户流露焦虑、自责、压力或犹豫时，先用一两句具体、真诚的话回应，再处理任务。不评判、不说教。
- 语气亲切、可爱但保持克制，仅在有助于推进任务时追问。
- 不展示思维链、内部阶段名称或冗长的工具过程，只提供结论、关键依据和未完成项。

## 财务数据规范
- 内部存储和工具调用中，金额单位一律为“分”（整数）。从用户话中提取金额时先转为分，再传工具。
- 向用户展示金额时，统一换算为“元”，保留两位小数（如 1250分 -> 12.50元）。
- 流水类型仅限：expense（支出）、income（收入）、transfer（转账）、adjustment（调账）。使用时严格按此枚举。
- 涉及计算、百分比或汇总时必须使用计算工具，不得口算。
- 分析、建议或预测类结论末尾加“仅供参考”；余额、流水等事实性结果无需添加。

## 安全与边界
- 严禁提供投资、理财建议，不评判用户消费观念。
- 保持专业与温柔的平衡，不主动询问或存储敏感财务凭证（如银行卡号、身份证信息）。所有数据操作均通过系统工具完成，不自行留存原始输入。
- 若用户要求超出记账范围，礼貌说明能力边界，并引导回与记账、财务理解相关的对话。`

/** 工具目录缓存键（工具内容签名），null 表示尚未构建 */
let toolCatalogCacheKey: string | null = null
/** 工具目录缓存值，内容不变时复用 */
let toolCatalogCache: string | null = null

/**
 * 构建稳定的 System Prompt
 * 按执行顺序拼接系统规则、Skill 目录、内置工具和 MCP 工具。
 * 系统规则保持稳定，Skill 目录低频变化，内置工具目录基于内容签名复用。
 * runtime_context（日期、用户名、记忆）不进入 system prompt，放在末尾消息中。
 *
 * @param skillDefs 已启用的 Skill
 * @param groupedTools 按分组组织的内置工具信息
 * @param mcpToolInfos MCP 外部工具信息
 * @returns System Prompt
 * @author xiangwei
 */
export function buildSystemPrompt(
    skillDefs: SkillDefinition[],
    groupedTools: ToolGroupInfo[],
    mcpToolInfos: McpToolRuntimeInfo[]
): string {
    // 工具目录基于内容签名缓存，避免每轮重复格式化。
    const toolKey = groupedTools
        .map(
            (group) =>
                `${group.label}|${group.tools.map((t) => `${t.name}:${t.description}`).join(',')}`
        )
        .join(';')
    if (toolCatalogCacheKey !== toolKey || toolCatalogCache === null) {
        const toolSections = groupedTools
            .map(
                (group) =>
                    `**${group.label}**：${group.tools.map((t) => `${t.name}（${t.description}）`).join('、')}`
            )
            .join('\n')
        toolCatalogCache = `## 可用工具（内置）
以下工具可直接调用，按描述选择最精确的一个，不重复调用同类工具：
${toolSections}`
        toolCatalogCacheKey = toolKey
    }

    const skillDescriptions = skillDefs
        .map(
            (definition) =>
                `- ${definition.meta.name}（${definition.meta.displayName}）：${definition.meta.description}`
        )
        .join('\n')

    // MCP 工具段动态拼接，放在最末尾，变化只影响末尾缓存
    const mcpSection =
        mcpToolInfos.length > 0
            ? `\n\n## MCP 外部工具\n以下为已连接的外部服务工具，用于内置工具无法覆盖的场景（如网络搜索）：\n${formatMcpToolInfos(mcpToolInfos)}`
            : ''

    return `${SYSTEM_PROMPT_PREFIX}

## 可用 Skills
这是每轮任务开始时必须先扫描的能力目录。简介仅用于匹配，不能替代 getSkill 返回的完整内容：
${skillDescriptions || '- 暂无已启用 Skill'}

${toolCatalogCache}${mcpSection}

## 执行前检查
先匹配 Skill；命中后先 getSkill；读取完整内容后制定计划；按计划分步调用工具；最后验证结果。`
}

/**
 * 按服务分组格式化 MCP 工具信息
 *
 * @param infos MCP 工具信息列表
 * @returns 分组格式化文本
 * @author xiangwei
 */
function formatMcpToolInfos(infos: McpToolRuntimeInfo[]): string {
    const byServer = new Map<string, { name: string; description: string }[]>()
    for (const info of infos) {
        if (!byServer.has(info.serverName)) byServer.set(info.serverName, [])
        byServer.get(info.serverName)!.push({ name: info.name, description: info.description })
    }
    return Array.from(byServer.entries())
        .map(
            ([server, tools]) =>
                `**${server}**：${tools.map((t) => `${t.name}（${t.description || '无描述'}）`).join('、')}`
        )
        .join('\n')
}
