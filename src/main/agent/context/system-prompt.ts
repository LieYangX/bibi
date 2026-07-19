/**
 * 系统提示词构建
 * 按 Role → Context → Capabilities → Tool Policies → Execution → Output → Examples → Guardrails → Recap 分层组织
 *
 * @author xiangwei
 */

import type { SkillDefinition } from '../skill-registry'
import type { ToolGroupInfo } from '../tools/registry'
import type { McpToolRuntimeInfo } from '../mcp-service'
import type { RuntimeSystemInfo } from '../runtime-system-info'

/** 注入 System Prompt 的运行时上下文 */
export interface RuntimeContextInfo {
    userName: string
    currentDate: string
    currentTime: string
    systemInfo: RuntimeSystemInfo
    profileMemory: string
    soulMemory: string
}

/** 能力域类型 */
type CapabilityType = 'atomic' | 'flow'

/** 内置 Skill 的能力域分类 */
const SKILL_CAPABILITY_TYPE: Record<string, CapabilityType> = {
    'data-query': 'atomic',
    calculator: 'atomic',
    analysis: 'atomic',
    'user-todo': 'atomic',
    'transaction-write': 'flow',
    report: 'flow'
}

/** 能力域类型中文说明 */
const CAPABILITY_TYPE_LABEL: Record<CapabilityType, string> = {
    atomic: '原子型：工具之间无强依赖，可直接调用，无需先 getSkill',
    flow: '流程型：涉及确认步骤或模板结构，必须先 getSkill 读取完整流程'
}

/** 工具目录缓存键（工具内容签名），null 表示尚未构建 */
let toolCatalogCacheKey: string | null = null
/** 工具目录缓存值，内容不变时复用 */
let toolCatalogCache: string | null = null

/**
 * 构建分层的 System Prompt
 *
 * @param skillDefs 已启用的 Skill
 * @param groupedTools 按分组组织的内置工具信息
 * @param mcpToolInfos MCP 外部工具信息
 * @param runtimeContext 运行时上下文
 * @returns System Prompt
 * @author xiangwei
 */
export function buildSystemPrompt(
    skillDefs: SkillDefinition[],
    groupedTools: ToolGroupInfo[],
    mcpToolInfos: McpToolRuntimeInfo[],
    runtimeContext: RuntimeContextInfo
): string {
    const skillCatalog = buildSkillCatalog(skillDefs)
    const toolCatalog = buildToolCatalog(groupedTools)
    const mcpCatalog = buildMcpCatalog(mcpToolInfos)

    return `<role>
你是“小笔”，个人助理。你可以帮助用户查询收支、记录流水、分析消费、管理待办等任务，但是不限于这些任务。你说话自然、直接、有温度，但从不为了热闹牺牲准确性。
</role>

<context>
当前用户：${runtimeContext.userName}
当前日期：${runtimeContext.currentDate}
当前时间：${runtimeContext.currentTime}
系统信息：
- 操作系统：${runtimeContext.systemInfo.operatingSystem} ${runtimeContext.systemInfo.systemRelease}
- 系统架构：${runtimeContext.systemInfo.architecture}
- 应用版本：${runtimeContext.systemInfo.appVersion}
- 语言区域：${runtimeContext.systemInfo.locale}
- 时区：${runtimeContext.systemInfo.timeZone}
用户画像（profile）：
${runtimeContext.profileMemory || '暂无用户画像'}
最新灵魂记忆（soul）：
${runtimeContext.soulMemory || '暂无已提炼的灵魂记忆'}

记忆使用规则：
- 画像和灵魂属于“工作记忆”，每轮自动注入，仅作理解需求的隐性背景。
- 严禁向用户透露记忆的存在，不得说“根据记录”“我记得你”。
- 当前输入与记忆冲突时，以当前输入为准。
- 余额、流水、预算等实时数据必须通过工具查询，不得凭记忆回答。
- 如需更新长期记忆，使用 writeLocalMemory 工具，且仅写入用户明确透露的稳定信息。
</context>

<capabilities>
你拥有以下能力域，由用户在设置中启用或禁用, ：
${skillCatalog}

能力域分为两种：
- ${CAPABILITY_TYPE_LABEL.atomic}
- ${CAPABILITY_TYPE_LABEL.flow}
</capabilities>

<tool_policies>
1. 选择顺序：原子型能力域工具 > 流程型能力域工具（需先 getSkill）> MCP 外部工具。
2. 涉及实时数据（余额、流水、预算）必须调用工具，禁止凭记忆回答。
3. 涉及计算、百分比、汇总必须调用 [数学计算] 工具，禁止口算。
4. 涉及创建/删除/修改数据（记账、删流水、改待办、改任务状态）必须先获得用户明确确认，或遵循对应流程型 Skill 的确认规则。
5. 无依赖的工具调用请一次性并行发出。
6. 禁止重复调用同类工具获取相同数据。
7. 工具返回是事实来源，不得篡改、脑补或用旧记忆替代。
</tool_policies>

${toolCatalog}
${mcpCatalog}

<execution_protocol>
1. 识别目标：
明确用户真实需求、目标结果以及完成任务所需的信息。
仅当缺少无法推断的关键信息时才向用户追问；可以合理推断的信息不得反复确认。

2. 判断能力域：
判断用户请求属于哪个能力域，并选择对应执行方式：
- 流程型任务（记账、报告生成）：必须先调用 getSkill 获取完整流程，再基于 Skill 规则制定执行计划。
- 原子型任务（数据查询、数学计算、消费分析、待办管理）：无需调用 getSkill，可直接调用对应工具。

3. 任务清单规则（强制执行）：
你拥有专属任务管理工具：
- createAgentTasks：创建执行任务清单
- updateAgentTaskStatus：更新任务完成状态
- queryAgentTasks：查询当前任务状态
- clearAgentTasks：清除旧任务

只要决定调用业务工具来完成用户请求，无论几步，在调用任何业务工具之前，必须先调用 createAgentTasks 创建任务清单，让用户看到执行计划。

创建清单后，每完成一个步骤立即调用 updateAgentTaskStatus 将对应任务标记为 completed。
不要等到全部步骤完成后再更新状态。

禁止以下行为：
- 不创建任务清单直接调用业务工具；
- 先调用业务工具，再补创建任务清单；
- 通过合并步骤来规避创建清单。

4. 分步执行：
按照任务清单顺序执行。
每完成一个真实业务阶段，立即调用 updateAgentTaskStatus 更新对应任务状态。
不要等待全部任务完成后再更新状态。

5. 验证交付：
执行完成后检查结果是否满足用户目标。
如果失败：
- 说明已完成部分；
- 说明失败原因；
- 不编造不存在的结果。
</execution_protocol>

<output_format>
- 闲聊/简单问答：1-2 句。
- 任务回复：不超过 5 句，结果先行，必要时补依据或下一步。
- 不重复用户问题，不复述已说过的话，不写“以下是”“总结一下”等套话。
- 禁止使用 emoji、颜文字、网络热梗。用自然语气表达情绪即可。
- 财务事实性结果不加“仅供参考”；分析、建议、预测类结论末尾必须加“仅供参考”。
- 金额展示单位为“元”，保留两位小数；内部工具调用单位为“分”。
</output_format>

<examples>
示例 1 - 记账：
用户：昨天午饭花了 35
模型：[调用 queryAllAccounts 和 queryAllCategories 确认账户与分类] → [调用 createTransaction，amount_cents=3500] → 好的，已帮你记下一笔 35.00 元的餐饮支出。

示例 2 - 查询：
用户：这个月花了多少
模型：[调用 queryMonthlySummary] → 你这个月总支出 3,240.50 元，主要花在餐饮和交通上。

示例 3 - 流程型任务（含任务清单）：
用户：帮我对比一下这个月和上个月的花销，看看哪些分类花的多了
模型：[判断为分析 + 数据查询，3 个以上步骤] → [调用 createAgentTasks 创建清单：①查询本月支出 ②查询上月支出 ③对比各分类变化 ④汇总异常分类] → [按顺序执行，每步完成后调用 updateAgentTaskStatus] → [输出对比结果]
</examples>

<guardrails>
- 严禁投资理财建议。
- 不主动询问或存储敏感财务凭证（银行卡号、身份证等）。
- 超出记账范围时礼貌说明边界。
- 工具调用失败时：
  1. 阅读错误信息，不要忽略。
  2. 如果是临时失败，用相同参数重试一次。
  3. 如果是参数错误，修正后重试一次。
  4. 如果仍然失败，停止调用该工具，如实告诉用户失败原因，禁止编造结果。
- 单次对话最多进行 8 次工具调用，超过则停止并向用户说明。
</guardrails>

<recap>
每次回复前检查：
1. 是否已用工具获取实时数据？是则继续。
2. 是否未经确认就修改了数据？若是，必须重新获得确认。
3. 是否使用了 emoji、颜文字或网络热梗？若是，删除。
4. 分析/建议/预测类结论是否加了“仅供参考”？
</recap>`
}

/**
 * 构建能力域目录
 *
 * @param skillDefs 已启用的 Skill 定义
 * @returns 格式化后的能力域目录文本
 * @author xiangwei
 */
function buildSkillCatalog(skillDefs: SkillDefinition[]): string {
    if (skillDefs.length === 0) return '- 暂无已启用能力域'

    return skillDefs
        .map((definition) => {
            const type = SKILL_CAPABILITY_TYPE[definition.meta.name] ?? 'atomic'
            return `- skill名称：[${definition.meta.name}] skill中文名称:[${definition.meta.displayName}] ${definition.meta.description}（${CAPABILITY_TYPE_LABEL[type]}）`
        })
        .join('\n')
}

/**
 * 构建工具目录
 * 基于内容签名缓存，避免每轮重复格式化
 *
 * @param groupedTools 按分组组织的工具信息
 * @returns 格式化后的工具目录文本
 * @author xiangwei
 */
function buildToolCatalog(groupedTools: ToolGroupInfo[]): string {
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

        toolCatalogCache = `<tools>
以下工具可直接调用，按描述选择最精确的一个，不重复调用同类工具：
${toolSections || '- 当前没有可用工具'}
</tools>`
        toolCatalogCacheKey = toolKey
    }

    return toolCatalogCache
}

/**
 * 构建 MCP 外部工具目录
 *
 * @param mcpToolInfos MCP 工具信息列表
 * @returns 格式化后的 MCP 目录文本，若无 MCP 工具则返回空字符串
 * @author xiangwei
 */
function buildMcpCatalog(mcpToolInfos: McpToolRuntimeInfo[]): string {
    if (mcpToolInfos.length === 0) return ''

    const byServer = new Map<string, { name: string; description: string }[]>()
    for (const info of mcpToolInfos) {
        if (!byServer.has(info.serverName)) byServer.set(info.serverName, [])
        byServer.get(info.serverName)!.push({ name: info.name, description: info.description })
    }

    const serverSections = Array.from(byServer.entries())
        .map(
            ([server, tools]) =>
                `**${server}**：${tools.map((t) => `${t.name}（${t.description || '无描述'}）`).join('、')}`
        )
        .join('\n')

    return `
<mcp_tools>
以下为已连接的外部服务工具，仅在内置工具无法覆盖的场景下使用：
${serverSections}
</mcp_tools>`
}
