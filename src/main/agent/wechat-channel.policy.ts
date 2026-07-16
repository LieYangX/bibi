/**
 * 微信渠道二维码状态策略
 *
 * @author xiangwei
 */

/** 微信二维码服务状态 */
export type WechatQrStatus = 'wait' | 'scaned' | 'confirmed' | 'expired'

/**
 * 判断二维码状态是否需要重新获取
 *
 * @param status 二维码状态
 * @returns 是否需要重新获取
 * @author xiangwei
 */
export function shouldRefreshWechatQrCode(status: WechatQrStatus): boolean {
    return status === 'expired'
}
