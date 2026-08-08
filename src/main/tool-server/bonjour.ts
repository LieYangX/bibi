/**
 * Bonjour 广播服务
 *
 * 在局域网内广播 _bibi-tools._tcp 服务，供 iOS 端发现 PC 端工具服务器。
 *
 * @author xiangwei
 */

import Bonjour from 'bonjour-service'
import { getPersistedCurrentUserId } from '../services/session.service'
import { getUser } from '../services/user.service'
import { logger } from '../utils/logger'

/** Bonjour 广播端口 */
const BONJOUR_PORT = 19877

/** Bonjour 服务类型 */
const SERVICE_TYPE = 'bibi-tools'

/** 协议版本 */
const PROTOCOL_VERSION = '1'

/** Bonjour 实例 */
let bonjour: Bonjour | null = null

/** 已发布服务 */
let publishedService: ReturnType<Bonjour['publish']> | null = null

/**
 * 启动 Bonjour 广播
 *
 * 在局域网内广播 _bibi-tools._tcp 服务，iOS 端通过 NetServiceBrowser 发现。
 *
 * @author xiangwei
 */
export async function startBonjourBroadcast(): Promise<void> {
    bonjour = new Bonjour()

    // 获取当前用户名用于 TXT 记录
    const userId = await getPersistedCurrentUserId()
    let userName = 'unknown'

    if (userId) {
        const user = await getUser(userId)
        userName = user?.name ?? 'unknown'
    }

    publishedService = bonjour.publish({
        name: `bibi-${userName}`,
        type: SERVICE_TYPE,
        protocol: 'tcp',
        port: BONJOUR_PORT,
        txt: {
            version: PROTOCOL_VERSION,
            user: userName,
            http_port: '19878'
        }
    })

    logger.info('ToolServer', 'Bonjour 广播已启动', {
        serviceName: `bibi-${userName}`,
        port: BONJOUR_PORT,
        user: userName
    })
}

/**
 * 停止 Bonjour 广播
 *
 * @author xiangwei
 */
export function stopBonjourBroadcast(): void {
    if (publishedService) {
        publishedService.stop()
        publishedService = null
    }

    if (bonjour) {
        bonjour.destroy()
        bonjour = null
    }

    logger.info('ToolServer', 'Bonjour 广播已停止')
}
