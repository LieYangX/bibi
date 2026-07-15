import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHttpClient, HttpClientError } from '../../src/main/utils/http-client'

describe('统一 HTTP 客户端', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('统一拼接基础地址、查询参数和 JSON 请求头', async () => {
        const fetchMock = vi.fn(
            async () =>
                new Response(JSON.stringify({ ok: true }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
        )
        vi.stubGlobal('fetch', fetchMock)
        const client = createHttpClient({ baseUrl: 'https://example.com' })

        await expect(
            client.get<{ ok: boolean }>('/weather', {
                query: { city: '南昌', extended: true, ignored: undefined }
            })
        ).resolves.toEqual({ ok: true })

        const [url, init] = fetchMock.mock.calls[0]
        expect((url as URL).href).toBe(
            'https://example.com/weather?city=%E5%8D%97%E6%98%8C&extended=true'
        )
        expect(init?.method).toBe('GET')
        expect(new Headers(init?.headers).get('Accept')).toBe('application/json')
    })

    it('统一序列化 POST 请求体并映射 HTTP 错误', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ id: 'result-1' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
            .mockResolvedValueOnce(new Response('', { status: 503 }))
        vi.stubGlobal('fetch', fetchMock)
        const client = createHttpClient({ baseUrl: 'https://example.com/api' })

        await expect(client.post('/items', { name: '测试' })).resolves.toEqual({ id: 'result-1' })
        expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ name: '测试' }))
        expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get('Content-Type')).toBe(
            'application/json'
        )

        const error = await client.get('/unavailable').catch((reason: unknown) => reason)
        expect(error).toBeInstanceOf(HttpClientError)
        expect((error as HttpClientError).status).toBe(503)
    })
})
