/**
 * 本地日期工具
 * @author xiangwei
 */

/**
 * 格式化本地日期，避免 UTC 转换导致日期偏移
 *
 * @param date 日期对象
 * @returns YYYY-MM-DD 日期
 * @author xiangwei
 */
export function formatLocalDate(date = new Date()): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * 格式化本地时间
 *
 * @param date 日期对象
 * @returns HH:mm 时间
 * @author xiangwei
 */
export function formatLocalTime(date = new Date()): string {
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${hour}:${minute}`
}
