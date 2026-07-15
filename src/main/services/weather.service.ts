/**
 * 天气查询服务
 * 通过 UAPI 获取基于公网 IP 定位的实时天气，并在内存中短时缓存。
 *
 * @author xiangwei
 */

import { z } from 'zod'
import type { WeatherSnapshot } from '@shared/types'
import { createHttpClient } from '../utils/http-client'

const WEATHER_CACHE_TTL_MS = 10 * 60 * 1_000

const weatherHttpClient = createHttpClient({
    baseUrl: 'https://uapis.cn',
    timeoutMs: 8_000
})

const weatherAlertSchema = z.object({
    title: z.string().trim().min(1),
    type: z.string().trim().default(''),
    level: z.string().trim().default('')
})

const weatherResponseSchema = z.object({
    province: z.string().trim().default(''),
    city: z.string().trim().default(''),
    district: z.string().trim().default(''),
    weather: z.string().trim().min(1),
    weather_icon: z.string().trim().default(''),
    temperature: z.coerce.number().finite(),
    wind_direction: z.string().trim().default(''),
    wind_power: z.string().trim().default(''),
    humidity: z.coerce.number().finite().min(0).max(100),
    report_time: z.string().trim().default(''),
    alerts: z.array(weatherAlertSchema).default([])
})

interface WeatherCache {
    value: WeatherSnapshot
    expiresAt: number
}

let weatherCache: WeatherCache | null = null

/**
 * 清空天气缓存
 *
 * @author xiangwei
 */
export function clearWeatherCache(): void {
    weatherCache = null
}

/**
 * 请求并标准化当前天气
 *
 * @returns 天气快照
 * @author xiangwei
 */
async function fetchCurrentWeather(): Promise<WeatherSnapshot> {
    const response = await weatherHttpClient.get<unknown>('/api/v1/misc/weather')
    const parsed = weatherResponseSchema.safeParse(response)
    if (!parsed.success) throw new Error('天气服务返回数据格式异常')
    return {
        province: parsed.data.province,
        city: parsed.data.city,
        district: parsed.data.district,
        weather: parsed.data.weather,
        weatherIcon: parsed.data.weather_icon,
        temperature: parsed.data.temperature,
        windDirection: parsed.data.wind_direction,
        windPower: parsed.data.wind_power,
        humidity: parsed.data.humidity,
        reportTime: parsed.data.report_time,
        alerts: parsed.data.alerts,
        isStale: false
    }
}

/**
 * 获取当前天气
 * 请求失败时优先返回最近一次缓存，避免天气服务影响首页主体功能。
 *
 * @param forceRefresh 是否跳过有效缓存
 * @returns 天气快照
 * @author xiangwei
 */
export async function getCurrentWeather(forceRefresh: boolean = false): Promise<WeatherSnapshot> {
    const now = Date.now()
    if (!forceRefresh && weatherCache && weatherCache.expiresAt > now) {
        return weatherCache.value
    }

    try {
        const value = await fetchCurrentWeather()
        weatherCache = { value, expiresAt: now + WEATHER_CACHE_TTL_MS }
        return value
    } catch (error: unknown) {
        if (weatherCache) return { ...weatherCache.value, isStale: true }
        if (error instanceof Error) throw error
        throw new Error('天气服务暂不可用')
    }
}
