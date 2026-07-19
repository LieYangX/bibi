/**
 * 本地记忆工具
 * 读取和写入当前用户的 profile 与 soul 记忆
 *
 * @author xiangwei
 */

import { tool, type Tool } from 'ai'
import { z } from 'zod'
import { getPersistedCurrentUserId } from '../../services/session.service'
import { logger } from '../../utils/logger'
import {
    localMemoryStore,
    MAX_LOCAL_MEMORY_CONTENT_LENGTH,
    type LocalMemoryType
} from '../memory/local-memory'

const memoryTypeSchema = z.enum(['profile', 'soul'])

const MEMORY_TOOL_DESCRIPTIONS = {
    readLocalMemory:
        '读取当前用户的本地长期记忆。profile 保存稳定的用户画像（姓名、职业、财务习惯等）；soul 保存从长期对话中提炼的情感倾向、表达习惯和互动偏好。当需要确认用户长期信息时使用，不要用它替代实时数据查询工具。',
    writeLocalMemory:
        '写入或更新当前用户的一类长期记忆。仅当用户明确透露了新的稳定信息（如职业变动、常住城市、记账偏好）时才调用；更新前应先读取旧画像并合并，禁止覆盖为 guessed 内容。'
} as const

/**
 * 校验工具执行期间登录用户没有发生切换
 *
 * @param userId 对话绑定的用户 ID
 * @author xiangwei
 */
async function assertCurrentUser(userId: string): Promise<void> {
    const currentUserId = await getPersistedCurrentUserId()
    if (!currentUserId || currentUserId !== userId) {
        throw new Error('用户会话已变更，请重新开始对话')
    }
}

/**
 * 创建本地记忆工具集
 *
 * @param userId 当前用户 ID
 * @returns readLocalMemory 和 writeLocalMemory 工具
 * @author xiangwei
 */
export function createMemoryTools(userId: string): Record<string, Tool> {
    const readLocalMemoryTool = tool({
        description: MEMORY_TOOL_DESCRIPTIONS.readLocalMemory,
        inputSchema: z.object({
            type: memoryTypeSchema.describe('要读取的记忆类型')
        }),
        execute: async ({ type }) => {
            await assertCurrentUser(userId)
            const document = await localMemoryStore.readMemory(userId, type)
            logger.info('AgentTool', '读取本地记忆', {
                memoryType: type,
                exists: document.exists,
                contentLength: document.content.length
            })
            return {
                type,
                exists: document.exists,
                updatedAt: document.updatedAt,
                content: document.content
            }
        }
    })

    const writeLocalMemoryTool = tool({
        description: MEMORY_TOOL_DESCRIPTIONS.writeLocalMemory,
        inputSchema: z.object({
            type: memoryTypeSchema.describe('要写入的记忆类型'),
            content: z
                .string()
                .trim()
                .min(1)
                .max(MAX_LOCAL_MEMORY_CONTENT_LENGTH)
                .describe('合并后的完整 Markdown 内容，而不是局部增量')
        }),
        execute: async ({ type, content }) => {
            await assertCurrentUser(userId)
            const document = await localMemoryStore.writeMemory(
                userId,
                type as LocalMemoryType,
                content
            )
            logger.info('AgentTool', '写入本地记忆', {
                memoryType: type,
                contentLength: document.content.length
            })
            return {
                type,
                updatedAt: document.updatedAt,
                saved: true
            }
        }
    })

    return {
        readLocalMemory: readLocalMemoryTool,
        writeLocalMemory: writeLocalMemoryTool
    }
}

/** 记忆工具展示信息 */
export const memoryToolInfos = [
    { name: 'readLocalMemory', description: MEMORY_TOOL_DESCRIPTIONS.readLocalMemory },
    { name: 'writeLocalMemory', description: MEMORY_TOOL_DESCRIPTIONS.writeLocalMemory }
]
