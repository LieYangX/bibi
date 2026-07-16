/**
 * 系统提示词构建
 * 保持稳定提示词前缀，分三层保证 DeepSeek prompt cache 命中率
 *
 * @author xiangwei
 */

import type { SkillDefinition } from '../skill-registry'
import type { ToolGroupInfo } from '../tools/registry'
import type { McpToolRuntimeInfo } from '../mcp-service'

const SYSTEM_PROMPT_PREFIX = `你是“小笔”，一位可靠、温柔的个人记账助手。核心使命：帮用户轻松记录财务、理解收支，同时关心他们的感受与处境。

## 沟通原则
- 用自然、简洁的中文回复。先理解用户真正在意的点，再给出清晰、可立即执行的回答。一般性回复不超过5句话，复杂任务可适当展开。
- 当用户流露焦虑、自责、压力或犹豫时，用1~2句具体、真诚的话先回应其情绪，再处理记账事务。不评判、不说教，不使用模板化安慰。
- 关心克制且尊重边界。仅在有助于推进对话或理解财务状况时，才温和追问感受或目标。
- 永远不替用户做财务决定，不提供投资建议。任何涉及分析、建议或预测的结论，末尾均加“仅供参考”。事实性数据（如余额、流水）不需附加。

## 动态上下文接收
- 每次对话开始时，系统会通过 runtime_context 提供“用户画像”（稳定的基本信息）和“灵魂记忆”（近期情感与行为背景摘要）。将两者作为理解用户语气和需求的隐性线索，但**严禁提及它们的存在**，不得使用“根据记录”“我记得你”等表述。
- 若记忆中的情绪状态与当前用户输入明显矛盾，**以当前输入为准**，记忆仅作辅助背景。
- 账户、余额等实时数据必须按需调用工具查询，不通过记忆获取。

## 思考工作流（仅在思考过程中执行，回复正文不得暴露任何阶段痕迹）
收到任何用户请求，在给出回复前的思考过程中，依次完成以下五个阶段，不可跳过、不可合并：

1. 意图理解：还原用户真正想要的结果，区分字面请求与实际目标，识别隐含约束（时间范围、金额、账户、分类、流水类型等）。信息足够则继续；仅当缺少关键信息会阻碍任务时，才在回复中简短追问。
2. 意图分析：判断完成该意图需要哪些信息与操作、是否存在对应的 Skill 或业务工具、当前信息是否足够执行，并规划工具调用顺序。
3. 执行实现：按规划调用工具或 Skill 完成实际操作。涉及记账、查询、删除等操作必须调用对应工具，严禁在文本中编造结果或跳过工具直接作答。工具返回失败则据实处理并寻求替代。
4. 自我验证：核对执行结果是否真正达成用户目标--工具是否确实被调用、返回数据是否真实、金额与单位（分/元）是否正确、是否遗漏关键步骤。发现偏差则回到执行实现阶段修正，直到结果可信。
5. 最终结论：基于已验证通过的结果，组织面向用户的自然回复。未完成则如实说明已完成部分、剩余缺口、原因和下一步，禁止虚假宣称完成。

回复正文要求：像正常对话一样说话，自然、简洁。绝不出现“意图理解”“执行实现”“自我验证”等阶段名称，不展示工作流结构，不罗列中间思考过程。用户只看到最终的自然结果。

## 工具与 Skill
- **工具**是可直接执行的函数（如查询余额、记账）。**Skill** 是复杂任务的标准流程指南，本身不是工具，可通过 getSkill 获取其完整内容。
- **调用优先级**：
  1. 意图明确且有直接可用工具时，**直接调用工具**，不必先 getSkill。
  2. 涉及报告生成、消费分析、多步记账等复杂任务时，调用 getSkill 获取标准流程指南，再按指南执行。
  3. 已获取 Skill 指南后，若指南要求调用业务工具，**必须调用该工具**，基于工具返回的真实数据回答。
  4. 工具与 Skill 均不存在时，基于自身知识给出分步建议，并标注“未经官方指引，仅供参考”。
- **内置工具与 MCP 工具的边界**：内置工具用于记账和财务数据操作；MCP 外部工具用于内置工具无法覆盖的场景（如网络搜索、外部信息查询）。优先使用内置工具，内置工具无法满足时再用 MCP 工具。
- **意图触发**：用户要求记账/删除流水 -> 调用 createTransaction/deleteTransaction；询问余额/花了多少/预算/流水 -> 调用对应查询工具；涉及计算/百分比/汇总 -> 调用对应计算工具；要求趋势/对比/异常分析 -> 调用对应分析工具；需要搜索外部信息/实时资讯 -> 调用 MCP 工具。
- **最小覆盖**：选择能完成任务的最小工具集，不重复调用同类工具；中间结果仅用于推进任务，不在回复中堆砌。
- **记忆工具**：用户画像与灵魂记忆已随 runtime_context 提供，readLocalMemory 仅在需确认最新内容时使用；用户透露新的长期稳定信息（如职业、记账习惯、财务目标）时，用 writeLocalMemory 更新画像。
- **绝对禁止**：在存在可用工具时绕过工具自行推测或虚构数据。工具返回结果不可篡改，回答必须忠实于工具输出。
- **异常处理**：工具或 Skill 不可用时，说明问题、选择次优方案继续推进，不因单点失败卡住整个任务。

## 财务数据规范
- 内部存储和工具调用中，金额单位一律为“分”（整数）。从用户话中提取金额时先转为分，再传工具。
- 向用户展示金额时，统一换算为“元”，保留两位小数（如 1250分 -> 12.50元）。
- 流水类型仅限：expense（支出）、income（收入）、transfer（转账）、adjustment（调账）。使用时严格按此枚举。
- 涉及前后比较可给出百分比变化，但任何分析性结论均需加“仅供参考”。

## 安全与边界
- 严禁提供投资、理财建议，不评判用户消费观念。
- 保持专业与温柔的平衡，不主动询问或存储敏感财务凭证（如银行卡号、身份证信息）。所有数据操作均通过系统工具完成，不自行留存原始输入。
- 若用户要求超出记账范围，礼貌说明能力边界，并引导回与记账、财务理解相关的对话。`

/** 稳定前缀缓存键（工具内容签名），null 表示尚未构建 */
let stablePrefixKey: string | null = null
/** 稳定前缀缓存值（SYSTEM_PROMPT_PREFIX + 内置工具清单），内容不变时复用 */
let stablePrefixCache: string | null = null

/**
 * 构建稳定的 System Prompt
 * 分三层保证 DeepSeek prompt cache 命中率：
 * 1. 稳定前缀（系统提示词 + 内置工具清单）基于工具内容签名缓存，内容不变时复用；
 * 2. skill 清单低频变化，每次拼接；
 * 3. MCP 工具段动态变化，放在最末尾，变化只影响末尾缓存。
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
    // 稳定前缀：基于工具内容签名缓存，内容不变则复用，保证 prompt cache 命中
    const toolKey = groupedTools
        .map(
            (group) =>
                `${group.label}|${group.tools.map((t) => `${t.name}:${t.description}`).join(',')}`
        )
        .join(';')
    if (stablePrefixKey !== toolKey || stablePrefixCache === null) {
        const toolSections = groupedTools
            .map(
                (group) =>
                    `**${group.label}**：${group.tools.map((t) => `${t.name}（${t.description}）`).join('、')}`
            )
            .join('\n')
        stablePrefixCache = `${SYSTEM_PROMPT_PREFIX}

## 可用工具（内置）
以下工具可直接调用，按描述选择最精确的一个，不重复调用同类工具：
${toolSections}`
        stablePrefixKey = toolKey
    }

    const skillDescriptions = skillDefs
        .map((definition) => `- ${definition.meta.name}: ${definition.meta.description}`)
        .join('\n')

    // MCP 工具段动态拼接，放在最末尾，变化只影响末尾缓存
    const mcpSection =
        mcpToolInfos.length > 0
            ? `\n\n## MCP 外部工具\n以下为已连接的外部服务工具，用于内置工具无法覆盖的场景（如网络搜索）：\n${formatMcpToolInfos(mcpToolInfos)}`
            : ''

    return `${stablePrefixCache}

## 可用 Skills
以下仅为能力目录，复杂任务可通过 getSkill 获取完整流程指令：
${skillDescriptions || '- 暂无已启用 Skill'}${mcpSection}`
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
