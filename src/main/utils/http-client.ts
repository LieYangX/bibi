/**
 * 主进程统一 HTTP 客户端
 * 集中处理基础地址、查询参数、超时、JSON 请求体和公开错误。
 *
 * @author xiangwei
 */

/** HTTP 查询参数值 */
export type HttpQueryValue = string | number | boolean | null | undefined

/** HTTP 客户端配置 */
export interface HttpClientConfig {
    baseUrl: string
    timeoutMs?: number
    headers?: Record<string, string>
}

/** 单次 HTTP 请求配置 */
export interface HttpRequestOptions {
    query?: Record<string, HttpQueryValue>
    headers?: Record<string, string>
    body?: unknown
    timeoutMs?: number
    signal?: AbortSignal
}

const DEFAULT_HTTP_TIMEOUT_MS = 10_000

/**
 * HTTP 客户端错误
 *
 * @author xiangwei
 */
export class HttpClientError extends Error {
    readonly status?: number

    /**
     * 创建 HTTP 客户端错误
     *
     * @param message 错误信息
     * @param status HTTP 状态码
     * @param cause 原始异常
     * @author xiangwei
     */
    constructor(message: string, status?: number, cause?: unknown) {
        super(message, { cause })
        this.name = 'HttpClientError'
        this.status = status
    }
}

/**
 * 可复用 HTTP 客户端
 *
 * @author xiangwei
 */
export class HttpClient {
    private readonly baseUrl: URL
    private readonly timeoutMs: number
    private readonly headers: Record<string, string>

    /**
     * 创建 HTTP 客户端
     *
     * @param config 客户端配置
     * @author xiangwei
     */
    constructor(config: HttpClientConfig) {
        this.baseUrl = new URL(config.baseUrl)
        this.timeoutMs = config.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS
        this.headers = { Accept: 'application/json', ...config.headers }
    }

    /**
     * 发送 GET 请求并解析 JSON
     *
     * @param path 相对路径
     * @param options 请求配置
     * @returns JSON 响应
     * @author xiangwei
     */
    get<T>(path: string, options?: Omit<HttpRequestOptions, 'body'>): Promise<T> {
        return this.request<T>('GET', path, options)
    }

    /**
     * 发送 POST 请求并解析 JSON
     *
     * @param path 相对路径
     * @param body JSON 请求体
     * @param options 请求配置
     * @returns JSON 响应
     * @author xiangwei
     */
    post<T>(path: string, body: unknown, options?: Omit<HttpRequestOptions, 'body'>): Promise<T> {
        return this.request<T>('POST', path, { ...options, body })
    }

    /**
     * 发送 HTTP 请求并解析 JSON
     *
     * @param method HTTP 方法
     * @param path 相对路径
     * @param options 请求配置
     * @returns JSON 响应
     * @author xiangwei
     */
    async request<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        path: string,
        options: HttpRequestOptions = {}
    ): Promise<T> {
        const url = this.buildUrl(path, options.query)
        const controller = new AbortController()
        const sourceSignal = options.signal
        let timedOut = false
        const onAbort = (): void => controller.abort(sourceSignal?.reason)
        sourceSignal?.addEventListener('abort', onAbort, { once: true })
        const timer = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, options.timeoutMs ?? this.timeoutMs)

        try {
            const hasBody = options.body !== undefined
            const response = await fetch(url, {
                method,
                headers: {
                    ...this.headers,
                    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
                    ...options.headers
                },
                body: hasBody ? JSON.stringify(options.body) : undefined,
                signal: controller.signal
            })
            if (!response.ok) {
                throw new HttpClientError(
                    `外部服务响应异常（HTTP ${response.status}）`,
                    response.status
                )
            }
            if (response.status === 204) return undefined as T
            try {
                return (await response.json()) as T
            } catch (error: unknown) {
                throw new HttpClientError('外部服务返回的 JSON 格式无效', response.status, error)
            }
        } catch (error: unknown) {
            if (error instanceof HttpClientError) throw error
            if (timedOut) throw new HttpClientError('外部服务请求超时', undefined, error)
            if (sourceSignal?.aborted) throw error
            throw new HttpClientError('外部服务网络请求失败', undefined, error)
        } finally {
            clearTimeout(timer)
            sourceSignal?.removeEventListener('abort', onAbort)
        }
    }

    /**
     * 构建包含查询参数的请求地址
     *
     * @param path 相对路径
     * @param query 查询参数
     * @returns 完整 URL
     * @author xiangwei
     */
    private buildUrl(path: string, query?: Record<string, HttpQueryValue>): URL {
        const normalizedPath = path.startsWith('/') ? path.slice(1) : path
        const baseUrl = this.baseUrl.href.endsWith('/')
            ? this.baseUrl
            : new URL(`${this.baseUrl.href}/`)
        const url = new URL(normalizedPath, baseUrl)
        for (const [key, value] of Object.entries(query ?? {})) {
            if (value === null || value === undefined) continue
            url.searchParams.set(key, String(value))
        }
        return url
    }
}

/**
 * 创建统一 HTTP 客户端实例
 *
 * @param config 客户端配置
 * @returns HTTP 客户端
 * @author xiangwei
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
    return new HttpClient(config)
}
