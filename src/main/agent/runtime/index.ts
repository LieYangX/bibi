/**
 * 运行时基础工具统一导出
 * 组合 Skill 加载工具、本地记忆工具和任务规划工具
 *
 * @author xiangwei
 */

import type { AgentToolInfo } from '@shared/types'
import type { Tool } from 'ai'
import { createSkillLoaderTool, skillLoaderInfo } from './skill-loader.tool'
import { createMemoryTools, memoryToolInfos } from './memory-tools'
import { runWithAgentContext, type AgentRunContext } from '../agent-run-context'
import {
    createAgentTasksTool,
    updateAgentTaskStatusTool,
    queryAgentTasksTool,
    clearAgentTasksTool
} from './task-planning-tools'
import { executeCommandTool, editFileTool } from './system-tools'

/** 任务规划工具信息 */
const taskPlanningToolInfos: AgentToolInfo[] = [
    {
        name: 'createAgentTasks',
        description: (createAgentTasksTool as Tool & { description?: string }).description ?? '',
        parameters: {}
    },
    {
        name: 'updateAgentTaskStatus',
        description:
            (updateAgentTaskStatusTool as Tool & { description?: string }).description ?? '',
        parameters: {}
    },
    {
        name: 'queryAgentTasks',
        description: (queryAgentTasksTool as Tool & { description?: string }).description ?? '',
        parameters: {}
    },
    {
        name: 'clearAgentTasks',
        description: (clearAgentTasksTool as Tool & { description?: string }).description ?? '',
        parameters: {}
    }
]

/** 系统工具信息 */
const systemToolInfos: AgentToolInfo[] = [
    {
        name: 'executeCommand',
        description: (executeCommandTool as Tool & { description?: string }).description ?? '',
        parameters: {}
    },
    {
        name: 'editFile',
        description: (editFileTool as Tool & { description?: string }).description ?? '',
        parameters: {}
    }
]

/**
 * 创建当前对话的运行时基础工具
 *
 * @param userId 当前用户 ID
 * @param runContext 可选的 Agent 运行时上下文，任务规划工具需要它来访问对话上下文
 * @returns AI SDK 工具字典
 * @author xiangwei
 */
export function createRuntimeTools(
    userId: string,
    runContext?: AgentRunContext
): Record<string, Tool> {
    return {
        getSkill: createSkillLoaderTool(userId),
        ...createMemoryTools(userId),
        createAgentTasks: runContext
            ? wrapToolContext(createAgentTasksTool, runContext)
            : createAgentTasksTool,
        updateAgentTaskStatus: runContext
            ? wrapToolContext(updateAgentTaskStatusTool, runContext)
            : updateAgentTaskStatusTool,
        queryAgentTasks: runContext
            ? wrapToolContext(queryAgentTasksTool, runContext)
            : queryAgentTasksTool,
        clearAgentTasks: runContext
            ? wrapToolContext(clearAgentTasksTool, runContext)
            : clearAgentTasksTool,
        executeCommand: runContext
            ? wrapToolContext(executeCommandTool, runContext)
            : executeCommandTool,
        editFile: runContext ? wrapToolContext(editFileTool, runContext) : editFileTool
    }
}

/**
 * 为工具包裹 Agent 运行时上下文
 * 确保工具内 getCurrentAgentContext() 能正常取值
 *
 * @param rawTool 原始工具
 * @param runContext Agent 运行时上下文
 * @returns 包裹后的工具
 * @author xiangwei
 */
function wrapToolContext(rawTool: Tool, runContext: AgentRunContext): Tool {
    const original = rawTool as Tool & { description?: string; inputSchema?: unknown }
    return {
        description: original.description ?? '',
        inputSchema: original.inputSchema,
        execute: async (input: Record<string, unknown>) => {
            return runWithAgentContext(runContext, () =>
                (original.execute as (input: Record<string, unknown>) => unknown)(input)
            )
        }
    } as Tool
}

/**
 * 获取运行时基础工具展示信息
 *
 * @returns 工具展示信息
 * @author xiangwei
 */
export function getRuntimeToolInfos(): AgentToolInfo[] {
    return [skillLoaderInfo, ...memoryToolInfos, ...taskPlanningToolInfos, ...systemToolInfos].map(
        (info) => ({
            name: info.name,
            description: info.description,
            parameters: {}
        })
    )
}
