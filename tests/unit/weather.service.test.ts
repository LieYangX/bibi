import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearWeatherCache, getCurrentWeather } from '../../src/main/services/weather.service'

const WEATHER_RESPONSE = {
    province: '江西省',
    city: '南昌市',
    district: '东湖区',
    weather: '晴',
    weather_icon: '100',
    temperature: 35,
    wind_direction: '东风',
    wind_power: '4级',
    humidity: 54,
    report_time: '7 分钟前发布',
    alerts: [{ title: '高温黄色预警', type: '高温', level: '黄色' }]
}

/**
 * 创建天气接口 JSON 响应
 *
 * @param payload 响应内容
 * @returns JSON 响应
 * @author xiangwei
 */
function createWeatherResponse(payload: unknown = WEATHER_RESPONSE): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })
}

describe('天气服务', () => {
    beforeEach(() => clearWeatherCache())

    afterEach(() => {
        clearWeatherCache()
        vi.unstubAllGlobals()
    })

    it('标准化天气字段并复用十分钟缓存', async () => {
        const fetchMock = vi.fn(async () => createWeatherResponse())
        vi.stubGlobal('fetch', fetchMock)

        const first = await getCurrentWeather()
        const second = await getCurrentWeather()

        expect(first).toEqual({
            province: '江西省',
            city: '南昌市',
            district: '东湖区',
            weather: '晴',
            weatherIcon: '100',
            temperature: 35,
            windDirection: '东风',
            windPower: '4级',
            humidity: 54,
            reportTime: '7 分钟前发布',
            alerts: [{ title: '高温黄色预警', type: '高温', level: '黄色' }],
            isStale: false
        })
        expect(second).toEqual(first)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('强制刷新失败时返回最近缓存并标记为旧数据', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(createWeatherResponse())
            .mockRejectedValueOnce(new Error('network down'))
        vi.stubGlobal('fetch', fetchMock)

        await getCurrentWeather()
        const fallback = await getCurrentWeather(true)

        expect(fallback.isStale).toBe(true)
        expect(fallback.city).toBe('南昌市')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('拒绝缺少核心字段的天气响应', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => createWeatherResponse({ city: '南昌市' }))
        )

        await expect(getCurrentWeather()).rejects.toThrow('天气服务返回数据格式异常')
    })
})
