/**
 * 工具服务器共享类型定义
 * @author xiangwei
 */

import type { IpcResult } from './api'

/** 已配对设备信息 */
export interface PairedDevice {
    token: string
    deviceName: string
    pairedAt: string
    lastSeenAt: string
}

/** 工具服务器开关状态 */
export interface ToolServerStatus {
    enabled: boolean
}

/** 配对码生成结果 */
export interface PairingCodeResult {
    code: string
    expiresIn: number
}

/** 工具服务器 API 声明 */
export interface ToolServerAPI {
    getStatus: () => Promise<IpcResult<ToolServerStatus>>
    toggle: (enable: boolean) => Promise<IpcResult<ToolServerStatus>>
    generateCode: () => Promise<IpcResult<PairingCodeResult>>
    listDevices: () => Promise<IpcResult<PairedDevice[]>>
    revokeDevice: (token: string) => Promise<IpcResult>
}