/**
 * 系统工具 - 命令行执行
 * 在本地系统执行命令行命令，支持多平台
 * @author xiangwei
 */

import { tool } from 'ai'
import { z } from 'zod'
import { exec } from 'child_process'
import { promisify } from 'util'
import { getWorkspaceDir } from '../../../services/workspace.service'

const execAsync = promisify(exec)

/** 平台中文名映射 */
const PLATFORM_LABEL: Record<string, string> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux',
    aix: 'AIX',
    freebsd: 'FreeBSD'
}

export const executeCommandTool = tool({
    description:
        '在本地系统执行命令行命令。支持 Windows(cmd/pwsh)、macOS(zsh)、Linux(bash)，自动适配当前平台。返回 stdout、stderr 和退出码。不传 workdir 时默认使用工作目录（可在设置中配置）。',
    inputSchema: z.object({
        command: z.string().min(1).max(2000).describe('要执行的命令行命令'),
        workdir: z.string().optional().describe('工作目录（可选，默认设置中的工作目录）'),
        timeout: z
            .number()
            .int()
            .min(1000)
            .max(120000)
            .optional()
            .describe('超时时间（毫秒，默认 30000，最大 120000）')
    }),
    execute: async (input) => {
        const platform = process.platform
        const platformName = PLATFORM_LABEL[platform] ?? platform
        const cwd = input.workdir ?? (await getWorkspaceDir())

        try {
            const { stdout, stderr } = await execAsync(input.command, {
                cwd,
                timeout: input.timeout ?? 30000,
                maxBuffer: 10 * 1024 * 1024,
                encoding: 'utf-8'
            })
            return {
                success: true,
                platform,
                platformName,
                exitCode: 0,
                stdout: stdout.slice(0, 30000) || '(无输出)',
                stderr: stderr.slice(0, 10000) || '',
                truncated: stdout.length > 30000 || stderr.length > 10000
            }
        } catch (error: unknown) {
            const err = error as NodeJS.ErrnoException & {
                stdout?: string
                stderr?: string
                code?: string | number
            }
            const exitCode = err.code ?? -1
            const errorDetail = err.stderr?.slice(0, 10000) || err.message || ''
            return {
                success: false,
                platform,
                platformName,
                exitCode,
                stdout: err.stdout?.slice(0, 30000) ?? '',
                stderr: errorDetail,
                truncated: (err.stdout?.length ?? 0) > 30000 || (err.stderr?.length ?? 0) > 10000
            }
        }
    }
})
