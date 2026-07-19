/**
 * 系统工具 - 文件编辑
 * 读取文件内容或替换指定行范围，支持跨平台
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { getWorkspaceDir, isPathInWorkspace } from '../../../services/workspace.service'

export const editFileTool = tool({
    description:
        '读取或编辑文件。read 模式读取文件并显示行号；edit 模式替换指定行范围的内容（1-indexed，包含两端）。编辑时 oldString/newString 精准匹配优于行号替换。文件必须位于工作目录（可在设置中配置）内。',
    inputSchema: z.object({
        operation: z
            .enum(['read', 'edit'])
            .describe('操作类型：read=读取文件内容（带行号），edit=替换指定行范围'),
        filePath: z.string().min(1).describe('文件绝对路径'),
        startLine: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe('edit 模式：起始行号（1-indexed，包含该行）'),
        endLine: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe(
                'edit 模式：结束行号（1-indexed，包含该行）。不传则只替换 startLine 那一行。传了则替换 startLine 到 endLine 整个范围。'
            ),
        oldString: z
            .string()
            .optional()
            .describe(
                'edit 模式：被替换的原文精确匹配。传此参数时忽略 startLine/endLine，直接做字符串精确替换。'
            ),
        newString: z
            .string()
            .optional()
            .describe(
                'edit 模式：替换后的新内容。与 oldString 配合做精确替换，或与 startLine 配合做行范围替换。'
            )
    }),
    execute: async (input) => {
        const absPath = resolve(input.filePath)
        const workspaceDir = await getWorkspaceDir()

        // 检查文件是否在工作目录内
        if (!isPathInWorkspace(absPath, workspaceDir)) {
            return {
                success: false,
                error: `文件不在工作目录（${workspaceDir}）内，拒绝访问。可在设置中修改工作目录。`
            }
        }

        // read 模式
        if (input.operation === 'read') {
            const content = readFileSync(absPath, 'utf-8')
            const lines = content.split('\n')
            const numbered = lines.map((line, i) => `${i + 1}: ${line}`).join('\n')
            return {
                success: true,
                lineCount: lines.length,
                content: numbered.slice(0, 50000)
            }
        }

        // edit 模式
        if (input.operation === 'edit') {
            const content = readFileSync(absPath, 'utf-8')
            const lines = content.split('\n')

            let result: string[]

            if (input.oldString !== undefined) {
                // 精确字符串替换
                if (!content.includes(input.oldString)) {
                    return {
                        success: false,
                        error: '未找到匹配的 oldString，请使用 read 确认文件内容后重试',
                        fileContent: content.slice(0, 2000)
                    }
                }
                const newContent = input.newString ?? ''
                result = content.replace(input.oldString, newContent).split('\n')
            } else {
                // 行号范围替换
                if (!input.startLine) {
                    throw new Error('edit 模式需要提供 startLine 或 oldString')
                }
                const startIdx = input.startLine - 1
                const endIdx = (input.endLine ?? input.startLine) - 1

                if (startIdx < 0 || startIdx >= lines.length) {
                    throw new Error(
                        `startLine ${input.startLine} 超出文件行数范围（1-${lines.length}）`
                    )
                }
                if (endIdx < startIdx || endIdx >= lines.length) {
                    throw new Error(`endLine ${input.endLine ?? input.startLine} 超出文件行数范围`)
                }

                const prefix = lines.slice(0, startIdx)
                const suffix = lines.slice(endIdx + 1)
                const newLines = input.newString ? input.newString.split('\n') : []
                result = [...prefix, ...newLines, ...suffix]
            }

            writeFileSync(absPath, result.join('\n'), 'utf-8')

            return {
                success: true,
                fileLineCount: result.length
            }
        }

        throw new Error(`未知操作：${input.operation}`)
    }
})
