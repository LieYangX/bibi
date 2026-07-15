/**
 * 金额格式化工具
 * @author xiangwei
 */

/**
 * 将分（cents）转换为元字符串，保留两位小数
 *
 * @param cents 以分为单位的金额
 * @returns 元字符串，如 "1234.56"
 */
export function centsToYuan(cents: number): string {
    return (cents / 100).toFixed(2)
}

/**
 * 将元数值格式化为本地化字符串，保留两位小数
 *
 * @param yuan 以元为单位的金额
 * @returns 本地化金额字符串，如 "1,234.56"
 */
export function formatYuan(yuan: number): string {
    return yuan.toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })
}
