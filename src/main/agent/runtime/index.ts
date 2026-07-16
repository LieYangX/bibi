/**
 * 运行时基础工具统一导出
 * 组合 Skill 加载工具和本地记忆工具
 *
 * @author xiangwei
 */

import type { AgentToolInfo } from '@shared/types'
import type { Tool } from 'ai'
import { createSkillLoaderTool, skillLoaderInfo } from './skill-loader.tool'
import { createMemoryTools, memoryToolInfos } from './memory-tools'

/**
 * 创建当前对话的运行时基础工具
 *
 * @param userId 当前用户 ID
 * @returns AI SDK 工具字典
 * @author xiangwei
 */
export function createRuntimeTools(userId: string): Record<string, Tool> {
    return {
        getSkill: createSkillLoaderTool(userId),
        ...createMemoryTools(userId)
    }
}

/**
 * 获取运行时基础工具展示信息
 *
 * @returns 工具展示信息
 * @author xiangwei
 */
export function getRuntimeToolInfos(): AgentToolInfo[] {
    return [skillLoaderInfo, ...memoryToolInfos].map((info) => ({
        name: info.name,
        description: info.description,
        parameters: {}
    }))
}
