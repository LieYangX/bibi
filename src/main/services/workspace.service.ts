/**
 * 工作目录服务
 * 管理 AI 系统工具的基目录，默认用户主目录下的 bibi 子目录
 * @author xiangwei
 */

import { homedir } from 'os'
import { resolve, relative, isAbsolute, join } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { getSetting, setSetting } from './setting.service'
import { logger } from '../utils/logger'

/** 工作目录设置键 */
export const SETTING_KEY_WORKSPACE_DIR = 'agent_workspace_dir'

/** 默认工作目录子目录名 */
const DEFAULT_WORKSPACE_SUBDIR = 'bibi'

/**
 * 获取默认工作目录（用户主目录/bibi）
 *
 * @returns 默认工作目录绝对路径
 * @author xiangwei
 */
function getDefaultWorkspaceDir(): string {
    return join(homedir(), DEFAULT_WORKSPACE_SUBDIR)
}

/**
 * 获取配置的工作目录，未设置时返回 ~/bibi
 *
 * @returns 工作目录绝对路径
 * @author xiangwei
 */
export async function getWorkspaceDir(): Promise<string> {
    const configured = await getSetting<string>(SETTING_KEY_WORKSPACE_DIR)
    if (configured) {
        return resolve(configured)
    }
    return getDefaultWorkspaceDir()
}

/**
 * 初始化默认工作目录
 * 仅在用户未设置自定义目录且目标目录不存在时自动创建
 * 应用启动时调用
 *
 * @author xiangwei
 */
export async function ensureDefaultWorkspaceDir(): Promise<void> {
    const configured = await getSetting<string>(SETTING_KEY_WORKSPACE_DIR)
    // 用户已设置自定义目录，不做自动创建
    if (configured) return

    const defaultDir = getDefaultWorkspaceDir()
    if (existsSync(defaultDir)) {
        logger.info('Workspace', '默认工作目录已存在', { path: defaultDir })
        return
    }

    try {
        mkdirSync(defaultDir, { recursive: true })
        logger.info('Workspace', '默认工作目录已创建', { path: defaultDir })
    } catch (error: unknown) {
        logger.warn('Workspace', '创建默认工作目录失败', {
            path: defaultDir,
            error: error instanceof Error ? error.message : String(error)
        })
    }
}

/**
 * 设置工作目录
 *
 * @param dir 目录绝对路径
 * @author xiangwei
 */
export async function setWorkspaceDir(dir: string): Promise<void> {
    await setSetting(SETTING_KEY_WORKSPACE_DIR, dir)
}

/**
 * 将用户选择的基目录解析为实际工作目录（基目录/bibi），
 * 不存在则自动创建，保存到设置中。
 *
 * @param basePath 用户选择的基目录
 * @returns 实际工作目录绝对路径
 * @throws 目录创建失败时抛出异常
 * @author xiangwei
 */
export async function resolveAndSaveWorkspaceDir(basePath: string): Promise<string> {
    const workspacePath = join(resolve(basePath), DEFAULT_WORKSPACE_SUBDIR)
    if (!existsSync(workspacePath)) {
        mkdirSync(workspacePath, { recursive: true })
    }
    await setSetting(SETTING_KEY_WORKSPACE_DIR, workspacePath)
    return workspacePath
}

/**
 * 重置为默认工作目录（~/bibi），不存在则自动创建。
 *
 * @returns 默认工作目录绝对路径
 * @throws 目录创建失败时抛出异常
 * @author xiangwei
 */
export async function resetToDefaultWorkspaceDir(): Promise<string> {
    const defaultDir = getDefaultWorkspaceDir()
    if (!existsSync(defaultDir)) {
        mkdirSync(defaultDir, { recursive: true })
    }
    await setSetting(SETTING_KEY_WORKSPACE_DIR, defaultDir)
    return defaultDir
}

/**
 * 检查文件路径是否在工作目录内
 *
 * @param filePath 待检查的文件绝对路径
 * @param workspaceDir 工作目录
 * @returns 是否在工作目录内
 * @author xiangwei
 */
export function isPathInWorkspace(filePath: string, workspaceDir: string): boolean {
    const rel = relative(workspaceDir, filePath)
    // Windows: 不同盘符返回绝对路径（如 D:\xxx），Unix: 以 .. 开头表示目录外
    return !rel.startsWith('..') && !isAbsolute(rel)
}
