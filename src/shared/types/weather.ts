/**
 * 天气信息共享类型
 *
 * @author xiangwei
 */

/** 天气预警摘要 */
export interface WeatherAlert {
    title: string
    type: string
    level: string
}

/** 首页天气快照 */
export interface WeatherSnapshot {
    province: string
    city: string
    district: string
    weather: string
    weatherIcon: string
    temperature: number
    windDirection: string
    windPower: string
    humidity: number
    reportTime: string
    alerts: WeatherAlert[]
    isStale: boolean
}
