/**
 * 本地工具注册中心
 * 管理工具发现、用途描述和用户边界，工具可见性与 Skill 启停状态绑定。
 *
 * @author xiangwei
 */

import { tool, type Tool } from 'ai'
import type { AgentToolInfo } from '@shared/types'
import { getPersistedCurrentUserId, runWithBoundUserId } from '../../services/session.service'
import { logger } from '../../utils/logger'
import { summarizeLogValue } from '../../utils/log-sanitizer'
import * as dataQueryTools from '../capabilities/data-query'
import * as calculatorTools from '../capabilities/calculator'
import * as analysisTools from '../capabilities/analysis'
import * as transactionTools from '../capabilities/transaction-write'
import * as userTodoTools from '../capabilities/user-todo'
import { runWithAgentContext, type AgentRunContext } from '../agent-run-context'
import { createRuntimeTools, getRuntimeToolInfos } from '../runtime'

/** 工具分组定义 */
interface ToolGroupDefinition {
    name: string
    tools: Record<string, unknown>
}

/** 已注册业务工具 */
interface RegisteredTool {
    name: string
    group: string
    tool: Tool
}

/** 工具分组展示信息，用于系统提示词 */
export interface ToolGroupInfo {
    label: string
    tools: { name: string; description: string }[]
}

/** 分组中文标签 */
const GROUP_LABELS: Record<string, string> = {
    'data-query': '数据查询',
    calculator: '数学计算',
    analysis: '消费分析',
    'transaction-write': '记账操作',
    'user-todo': '待办管理'
}

const TOOL_GROUPS: ToolGroupDefinition[] = [
    { name: 'data-query', tools: dataQueryTools },
    { name: 'calculator', tools: calculatorTools },
    { name: 'analysis', tools: analysisTools },
    { name: 'transaction-write', tools: transactionTools },
    { name: 'user-todo', tools: userTodoTools }
]

/**
 * 本地工具注册中心
 *
 * @author xiangwei
 */
export class ToolRegistry {
    private readonly registeredTools: RegisteredTool[]

    /**
     * 扫描并校验所有内置业务工具
     *
     * @author xiangwei
     */
    constructor() {
        const registeredTools: RegisteredTool[] = []
        const names = new Set<string>()

        for (const group of TOOL_GROUPS) {
            for (const [exportName, toolImpl] of Object.entries(group.tools)) {
                if (!isTool(toolImpl)) continue
                const name = exportName.replace(/Tool$/, '')
                if (names.has(name)) throw new Error(`工具名称重复：${name}`)
                names.add(name)
                registeredTools.push({ name, group: group.name, tool: toolImpl })
            }
        }
        this.registeredTools = registeredTools
    }

    /**
     * 获取所有本地工具的用途说明
     *
     * @param enabledSkillNames 已启用 Skill 名称集合，用于过滤业务工具
     * @returns 工具展示信息
     * @author xiangwei
     */
    getToolInfos(enabledSkillNames?: Set<string>): AgentToolInfo[] {
        const businessTools = this.filterByEnabledSkills(
            this.registeredTools,
            enabledSkillNames
        ).map(({ name, tool: rawTool }) => {
            const raw = rawTool as Tool & { description?: string }
            return {
                name,
                description: raw.description ?? '',
                parameters: {}
            }
        })
        return [...getRuntimeToolInfos(), ...businessTools]
    }

    /**
     * 获取按分组组织的工具用途说明，用于系统提示词展示
     *
     * @param enabledSkillNames 已启用 Skill 名称集合，用于过滤业务工具
     * @returns 分组工具信息
     * @author xiangwei
     */
    getGroupedToolInfos(enabledSkillNames?: Set<string>): ToolGroupInfo[] {
        const filteredTools = this.filterByEnabledSkills(this.registeredTools, enabledSkillNames)
        const groups: ToolGroupInfo[] = []
        for (const [groupKey, label] of Object.entries(GROUP_LABELS)) {
            const tools = filteredTools
                .filter((registered) => registered.group === groupKey)
                .map(({ name, tool: rawTool }) => ({
                    name,
                    description: (rawTool as Tool & { description?: string }).description ?? ''
                }))
            if (tools.length > 0) {
                groups.push({ label, tools })
            }
        }
        const allRuntimeInfos = getRuntimeToolInfos()
        const runtimeTools = allRuntimeInfos.filter((info) => !isTaskPlanningTool(info.name))
        const taskPlanningInfos = allRuntimeInfos.filter((info) => isTaskPlanningTool(info.name))
        if (runtimeTools.length > 0) {
            groups.push({
                label: '运行时',
                tools: runtimeTools.map((info) => ({
                    name: info.name,
                    description: info.description
                }))
            })
        }
        if (taskPlanningInfos.length > 0) {
            groups.push({
                label: '任务规划',
                tools: taskPlanningInfos.map((info) => ({
                    name: info.name,
                    description: info.description
                }))
            })
        }
        return groups
    }

    /**
     * 为当前 Agent 运行时上下文创建完整的本地工具集合
     *
     * @param runContext Agent 运行时上下文（userId / conversationId / emit）
     * @param enabledSkillNames 已启用 Skill 名称集合，用于过滤业务工具
     * @returns AI SDK 工具字典
     * @author xiangwei
     */
    createTools(
        runContext: AgentRunContext,
        enabledSkillNames?: Set<string>
    ): Record<string, Tool> {
        const tools = createRuntimeTools(runContext.userId, runContext)
        for (const registered of this.filterByEnabledSkills(
            this.registeredTools,
            enabledSkillNames
        )) {
            tools[registered.name] = wrapToolWithUser(registered, runContext)
        }
        return tools
    }

    /**
     * 按已启用 Skill 名称过滤业务工具
     * 运行时工具（getSkill / memory）不受 Skill 启停影响，始终可用。
     *
     * @param tools 全部业务工具
     * @param enabledSkillNames 已启用 Skill 名称集合
     * @returns 过滤后的业务工具
     * @author xiangwei
     */
    private filterByEnabledSkills(
        tools: RegisteredTool[],
        enabledSkillNames?: Set<string>
    ): RegisteredTool[] {
        if (!enabledSkillNames || enabledSkillNames.size === 0) return []
        return tools.filter((registered) => enabledSkillNames.has(registered.group))
    }
}

/**
 * 判断对象是否为可执行 AI 工具
 *
 * @param value 待判断对象
 * @returns 是否为可执行工具
 * @author xiangwei
 */
function isTool(value: unknown): value is Tool {
    if (typeof value !== 'object' || value === null) return false
    const candidate = value as Record<string, unknown>
    return typeof candidate.execute === 'function' && candidate.inputSchema != null
}

/**
 * 为业务工具绑定用户边界与 Agent 上下文
 *
 * @param registered 已注册工具
 * @param runContext Agent 运行时上下文
 * @returns 绑定后的工具
 * @author xiangwei
 */
function wrapToolWithUser(registered: RegisteredTool, runContext: AgentRunContext): Tool {
    const raw = registered.tool as Tool & { description?: string; inputSchema?: unknown }

    return tool({
        description: raw.description ?? '',
        inputSchema: raw.inputSchema!,
        execute: async (args: Record<string, unknown>) => {
            const startedAt = Date.now()
            logger.info('AgentTool', '工具调用开始', {
                toolGroup: registered.group,
                toolName: registered.name,
                arguments: summarizeLogValue(args)
            })
            const currentUserId = await getPersistedCurrentUserId()
            if (!currentUserId || currentUserId !== runContext.userId) {
                logger.warn('AgentTool', '工具调用被用户会话变更中断', {
                    toolGroup: registered.group,
                    toolName: registered.name,
                    durationMs: Date.now() - startedAt
                })
                throw new Error('用户会话已变更，请重新开始对话')
            }

            try {
                const result = await runWithBoundUserId(runContext.userId, () =>
                    runWithAgentContext(runContext, () =>
                        (raw.execute as (input: Record<string, unknown>) => unknown)(args)
                    )
                )
                logger.info('AgentTool', '工具调用完成', {
                    toolGroup: registered.group,
                    toolName: registered.name,
                    durationMs: Date.now() - startedAt,
                    result: summarizeLogValue(result)
                })
                return result
            } catch (error: unknown) {
                logger.error('AgentTool', '工具调用失败', {
                    toolGroup: registered.group,
                    toolName: registered.name,
                    durationMs: Date.now() - startedAt,
                    error
                })
                return { error: error instanceof Error ? error.message : '工具执行失败' }
            }
        }
    })
}

/**
 * 判断工具名是否为任务规划工具
 *
 * @param name 工具名
 * @returns 是否为任务规划工具
 * @author xiangwei
 */
function isTaskPlanningTool(name: string): boolean {
    return [
        'createAgentTasks',
        'updateAgentTaskStatus',
        'queryAgentTasks',
        'clearAgentTasks'
    ].includes(name)
}

/** 全局本地工具注册中心 */
export const toolRegistry = new ToolRegistry()
