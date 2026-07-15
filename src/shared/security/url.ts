/**
 * 外链与应用内导航判断
 * @author xiangwei
 */

/**
 * 判断外链协议是否允许交给系统打开
 *
 * @param targetUrl 目标地址
 * @returns 是否允许
 * @author xiangwei
 */
export function isSafeExternalUrl(targetUrl: string): boolean {
    try {
        const protocol = new URL(targetUrl).protocol
        return protocol === 'https:' || protocol === 'http:'
    } catch {
        return false
    }
}

/**
 * 判断导航是否仍在当前应用页面内
 *
 * @param currentUrl 当前地址
 * @param targetUrl 目标地址
 * @returns 是否为应用内导航
 * @author xiangwei
 */
export function isApplicationNavigation(currentUrl: string, targetUrl: string): boolean {
    try {
        const current = new URL(currentUrl)
        const target = new URL(targetUrl)
        if (current.protocol === 'file:') {
            return target.protocol === 'file:' && target.pathname === current.pathname
        }
        return target.origin === current.origin
    } catch {
        return false
    }
}
