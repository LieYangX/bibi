/**
 * MCP 服务配置与运行时连接管理
 *
 * @author xiangwei
 */

import { createMCPClient } from '@ai-sdk/mcp'
import type { MCPClient } from '@ai-sdk/mcp'
import type { Tool } from 'ai'
import type {
    McpConnectionResult,
    McpServerConfig,
    McpServerInput,
    McpToolInfo
} from '@shared/types'
import { getSetting, setSetting } from '../services/setting.service'
import { logger } from '../utils/logger'

interface StoredMcpServer {
    url: string
    headers?: Record<string, string>
    enabled?: boolean
}

interface StoredMcpSettings {
    mcpServers: Record<string, StoredMcpServer>
}

/** MCP 工具运行时信息，用于系统提示词展示 */
export interface McpToolRuntimeInfo {
    name: string
    description: string
    serverName: string
}

/** MCP 运行时工具与连接句柄 */
export interface McpRuntimeTools {
    tools: Record<string, Tool>
    clients: MCPClient[]
    displayNames: Record<string, string>
    toolInfos: McpToolRuntimeInfo[]
}

const MCP_SETTINGS_KEY = 'agent_mcp_servers'
const DEFAULT_MCP_SERVER_NAME = 'exa'
const DEFAULT_MCP_SERVER_URL = 'https://mcp.exa.ai/mcp'
const MCP_REQUEST_TIMEOUT_MS = 15_000
const MCP_TOOL_NAME_MAX_LENGTH = 64
const MCP_SERVER_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

/** 用户首次使用时采用的默认 MCP 配置 */
export const DEFAULT_MCP_SETTINGS: Readonly<StoredMcpSettings> = {
    mcpServers: {
        exa: {
            url: DEFAULT_MCP_SERVER_URL
        }
    }
}

/**
 * 判断值是否为普通对象
 *
 * @param value 待判断值
 * @returns 是否为普通对象
 * @author xiangwei
 */
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 清洗 MCP 请求头，忽略无效字段
 *
 * @param value 原始请求头
 * @returns 可用请求头
 * @author xiangwei
 */
function normalizeHeaders(value: unknown): Record<string, string> {
    if (!isRecord(value)) return {}
    return Object.fromEntries(
        Object.entries(value).filter(
            (entry): entry is [string, string] =>
                entry[0].trim().length > 0 && typeof entry[1] === 'string'
        )
    )
}

/**
 * 判断 URL 是否可用于远程 MCP 连接
 *
 * @param value URL 字符串
 * @returns 是否为 HTTP 或 HTTPS URL
 * @author xiangwei
 */
function isSupportedUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

/**
 * 将存储值标准化为 MCP 服务列表
 *
 * @param value 原始存储值
 * @returns 有效的 MCP 服务列表
 * @author xiangwei
 */
export function normalizeMcpSettings(value: unknown): McpServerConfig[] {
    if (!isRecord(value) || !isRecord(value.mcpServers)) return []

    const servers: McpServerConfig[] = []
    for (const [name, rawServer] of Object.entries(value.mcpServers)) {
        if (!MCP_SERVER_NAME_PATTERN.test(name) || !isRecord(rawServer)) continue
        const url = typeof rawServer.url === 'string' ? rawServer.url.trim() : ''
        if (!isSupportedUrl(url)) continue
        servers.push({
            name,
            url,
            headers: normalizeHeaders(rawServer.headers),
            enabled: rawServer.enabled !== false,
            isDefault: name === DEFAULT_MCP_SERVER_NAME
        })
    }
    return servers
}

/**
 * 读取全部 MCP 服务配置
 *
 * @returns MCP 服务列表
 * @author xiangwei
 */
export async function getMcpServers(): Promise<McpServerConfig[]> {
    const stored = await getSetting<unknown>(MCP_SETTINGS_KEY)
    return normalizeMcpSettings(stored ?? DEFAULT_MCP_SETTINGS)
}

/**
 * 将 MCP 服务列表写回设置表
 *
 * @param servers MCP 服务列表
 * @author xiangwei
 */
async function saveMcpServers(servers: McpServerConfig[]): Promise<void> {
    const mcpServers = Object.fromEntries(
        servers.map((server) => [
            server.name,
            {
                url: server.url,
                headers: server.headers,
                enabled: server.enabled
            }
        ])
    )
    await setSetting(MCP_SETTINGS_KEY, { mcpServers } satisfies StoredMcpSettings)
}

/**
 * 新增或更新 MCP 服务
 *
 * @param input MCP 服务参数
 * @returns 更新后的服务列表
 * @author xiangwei
 */
export async function saveMcpServer(input: McpServerInput): Promise<McpServerConfig[]> {
    const servers = await getMcpServers()
    const previousName = input.previousName?.trim()
    const previousServer = previousName
        ? servers.find((server) => server.name === previousName)
        : undefined
    if (previousName && !previousServer) {
        throw new Error('待更新的 MCP 服务不存在')
    }
    if (previousServer?.isDefault && input.name !== previousServer.name) {
        throw new Error('系统默认 MCP 服务不能重命名')
    }
    const duplicate = servers.some(
        (server) => server.name === input.name && server.name !== previousName
    )
    if (duplicate) throw new Error(`MCP 服务 ${input.name} 已存在`)

    const nextServer: McpServerConfig = {
        name: input.name,
        url: input.url,
        headers: { ...input.headers },
        enabled: input.enabled,
        isDefault: input.name === DEFAULT_MCP_SERVER_NAME
    }
    const nextServers = previousName
        ? servers.filter((server) => server.name !== previousName)
        : [...servers]
    nextServers.push(nextServer)
    nextServers.sort((left, right) => left.name.localeCompare(right.name))
    await saveMcpServers(nextServers)
    return nextServers
}

/**
 * 删除 MCP 服务
 *
 * @param name 服务名称
 * @returns 更新后的服务列表
 * @author xiangwei
 */
export async function deleteMcpServer(name: string): Promise<McpServerConfig[]> {
    const servers = await getMcpServers()
    const target = servers.find((server) => server.name === name)
    if (!target) throw new Error('MCP 服务不存在')
    if (target.isDefault) throw new Error('系统默认 MCP 服务不能删除')
    const nextServers = servers.filter((server) => server.name !== name)
    await saveMcpServers(nextServers)
    return nextServers
}

/**
 * 更新 MCP 服务启用状态
 *
 * @param name 服务名称
 * @param enabled 是否启用
 * @returns 更新后的服务列表
 * @author xiangwei
 */
export async function toggleMcpServer(name: string, enabled: boolean): Promise<McpServerConfig[]> {
    const servers = await getMcpServers()
    const target = servers.find((server) => server.name === name)
    if (!target) throw new Error('MCP 服务不存在')
    target.enabled = enabled
    await saveMcpServers(servers)
    return servers
}

/**
 * 创建带请求超时的 MCP 网络请求函数
 *
 * @returns Fetch 实现
 * @author xiangwei
 */
function createMcpFetch(): typeof fetch {
    return async (input, init) => {
        if (init?.method?.toUpperCase() === 'GET') return fetch(input, init)

        const controller = new AbortController()
        const sourceSignal = init?.signal
        const onAbort = (): void => controller.abort(sourceSignal?.reason)
        sourceSignal?.addEventListener('abort', onAbort, { once: true })
        const timer = setTimeout(
            () => controller.abort(new Error('MCP 请求超时')),
            MCP_REQUEST_TIMEOUT_MS
        )
        try {
            return await fetch(input, { ...init, signal: controller.signal })
        } finally {
            clearTimeout(timer)
            sourceSignal?.removeEventListener('abort', onAbort)
        }
    }
}

/**
 * 创建单个 MCP 客户端
 *
 * @param server MCP 服务配置
 * @returns 已完成初始化的 MCP 客户端
 * @author xiangwei
 */
async function createClient(server: McpServerConfig): Promise<MCPClient> {
    return createMCPClient({
        clientName: 'bibi',
        maxRetries: 1,
        transport: {
            type: 'http',
            url: server.url,
            headers: server.headers,
            redirect: 'follow',
            fetch: createMcpFetch()
        },
        onUncaughtError: (error) => {
            logger.warn('MCP', 'MCP 客户端发生异步异常', {
                serverName: server.name,
                error
            })
        }
    })
}

/**
 * 将工具名称转换为模型可接受且跨服务唯一的名称
 *
 * @param serverName MCP 服务名称
 * @param toolName 原始工具名称
 * @returns 模型侧工具名称
 * @author xiangwei
 */
export function buildMcpToolName(serverName: string, toolName: string): string {
    const normalized = `mcp_${serverName}_${toolName}`.replace(/[^a-zA-Z0-9_-]/g, '_')
    return normalized.slice(0, MCP_TOOL_NAME_MAX_LENGTH)
}

/**
 * 读取 MCP 服务公开的工具摘要
 *
 * @param server MCP 服务配置
 * @returns 服务与工具信息
 * @author xiangwei
 */
export async function inspectMcpServer(server: McpServerConfig): Promise<McpConnectionResult> {
    const client = await createClient(server)
    try {
        const result = await client.listTools()
        const tools: McpToolInfo[] = result.tools.map((tool) => ({
            serverName: server.name,
            name: tool.name,
            description: tool.description ?? ''
        }))
        return {
            serverName: server.name,
            serverDisplayName: client.serverInfo.name || server.name,
            serverVersion: client.serverInfo.version || '',
            tools
        }
    } finally {
        await client.close()
    }
}

/**
 * 按名称检测已保存的 MCP 服务
 *
 * @param name 服务名称
 * @returns 服务与工具信息
 * @author xiangwei
 */
export async function inspectSavedMcpServer(name: string): Promise<McpConnectionResult> {
    const server = (await getMcpServers()).find((item) => item.name === name)
    if (!server) throw new Error('MCP 服务不存在')
    return inspectMcpServer(server)
}

/**
 * 加载全部已启用 MCP 服务的 AI 工具
 * 单个远程服务失败时保留其他服务及本地工具的可用性。
 *
 * @returns MCP 工具、客户端和显示名称
 * @author xiangwei
 */
export async function loadMcpRuntimeTools(): Promise<McpRuntimeTools> {
    const servers = (await getMcpServers()).filter((server) => server.enabled)
    const connected = await Promise.all(
        servers.map(async (server) => {
            let client: MCPClient | null = null
            try {
                client = await createClient(server)
                const remoteTools = await client.tools()
                return { server, client, remoteTools }
            } catch (error: unknown) {
                if (client) await client.close().catch(() => undefined)
                logger.warn('MCP', 'MCP 服务连接失败，已跳过远程工具', {
                    serverName: server.name,
                    url: server.url,
                    error
                })
                return null
            }
        })
    )

    const tools: Record<string, Tool> = {}
    const clients: MCPClient[] = []
    const displayNames: Record<string, string> = {}
    const toolInfos: McpToolRuntimeInfo[] = []
    for (const connection of connected) {
        if (!connection) continue
        clients.push(connection.client)
        for (const [remoteName, remoteTool] of Object.entries(connection.remoteTools)) {
            let exposedName = buildMcpToolName(connection.server.name, remoteName)
            let suffix = 2
            while (tools[exposedName]) {
                const suffixText = `_${suffix++}`
                exposedName = `${buildMcpToolName(connection.server.name, remoteName).slice(
                    0,
                    MCP_TOOL_NAME_MAX_LENGTH - suffixText.length
                )}${suffixText}`
            }
            tools[exposedName] = remoteTool as Tool
            displayNames[exposedName] = `${connection.server.name} · ${remoteName}`
            toolInfos.push({
                name: exposedName,
                description: (remoteTool as Tool & { description?: string }).description ?? '',
                serverName: connection.server.name
            })
        }
    }
    return { tools, clients, displayNames, toolInfos }
}

/**
 * 关闭本轮对话创建的全部 MCP 客户端
 *
 * @param clients MCP 客户端列表
 * @author xiangwei
 */
export async function closeMcpClients(clients: MCPClient[]): Promise<void> {
    await Promise.allSettled(clients.map((client) => client.close()))
}
