import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
    closeDatabaseConnection,
    getNativeDatabase,
    initializeDatabaseConnection
} from '../../src/main/database/drizzle'
import { runMigrations } from '../../src/main/database/drizzle/migrations'
import {
    deleteMcpServer,
    getMcpServers,
    normalizeMcpSettings,
    saveMcpServer,
    toggleMcpServer
} from '../../src/main/agent/mcp-service'

describe('MCP 配置持久化', () => {
    beforeAll(() => {
        initializeDatabaseConnection(':memory:')
        runMigrations(getNativeDatabase(), 'src/main/database/drizzle/migrations')
    })

    afterAll(() => closeDatabaseConnection())

    it('首次使用时提供默认 Exa MCP 服务', async () => {
        expect(await getMcpServers()).toEqual([
            {
                name: 'exa',
                url: 'https://mcp.exa.ai/mcp',
                headers: {},
                enabled: true,
                isDefault: true
            }
        ])
        await expect(deleteMcpServer('exa')).rejects.toThrow('系统默认 MCP 服务不能删除')
        await expect(
            saveMcpServer({
                previousName: 'exa',
                name: 'renamed-exa',
                url: 'https://mcp.exa.ai/mcp',
                headers: {},
                enabled: true
            })
        ).rejects.toThrow('系统默认 MCP 服务不能重命名')
    })

    it('支持新增、更新、启停和删除自定义 MCP 服务', async () => {
        await saveMcpServer({
            name: 'custom-search',
            url: 'https://example.com/mcp',
            headers: { Authorization: 'Bearer secret' },
            enabled: true
        })
        let servers = await toggleMcpServer('custom-search', false)
        expect(servers.find((server) => server.name === 'custom-search')?.enabled).toBe(false)

        servers = await saveMcpServer({
            previousName: 'custom-search',
            name: 'custom-web',
            url: 'https://example.com/v2/mcp',
            headers: {},
            enabled: true
        })
        expect(servers.some((server) => server.name === 'custom-search')).toBe(false)
        expect(servers.find((server) => server.name === 'custom-web')?.url).toBe(
            'https://example.com/v2/mcp'
        )

        servers = await deleteMcpServer('custom-web')
        expect(servers.map((server) => server.name)).toEqual(['exa'])
        await expect(
            saveMcpServer({
                previousName: 'missing-server',
                name: 'missing-server',
                url: 'https://example.com/mcp',
                headers: {},
                enabled: true
            })
        ).rejects.toThrow('待更新的 MCP 服务不存在')
    })

    it('忽略损坏的服务配置', () => {
        expect(
            normalizeMcpSettings({
                mcpServers: {
                    valid: { url: 'https://example.com/mcp' },
                    invalidProtocol: { url: 'file:///tmp/server' },
                    invalidName: { url: '' }
                }
            }).map((server) => server.name)
        ).toEqual(['valid'])
    })
})
