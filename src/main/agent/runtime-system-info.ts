/**
 * Agent 运行系统信息
 * 仅采集辅助回答所需的非敏感环境信息。
 *
 * @author xiangwei
 */

import { app } from 'electron'
import { release } from 'os'

/** 模型可见的运行系统信息 */
export interface RuntimeSystemInfo {
    operatingSystem: string
    systemRelease: string
    architecture: string
    appVersion: string
    locale: string
    timeZone: string
}

const OPERATING_SYSTEM_NAMES: Partial<Record<NodeJS.Platform, string>> = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux'
}

/**
 * 获取模型回答所需的非敏感系统信息
 *
 * @returns 当前运行系统信息
 * @author xiangwei
 */
export function getRuntimeSystemInfo(): RuntimeSystemInfo {
    const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return {
        operatingSystem: OPERATING_SYSTEM_NAMES[process.platform] ?? process.platform,
        systemRelease: release(),
        architecture: process.arch,
        appVersion: app.getVersion(),
        locale: app.getLocale() || '未知',
        timeZone: resolvedTimeZone || '未知'
    }
}
