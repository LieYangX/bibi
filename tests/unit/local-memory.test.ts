import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { LocalMemoryStore } from '../../src/main/agent/memory/local-memory'

const temporaryDirectories: string[] = []

async function createStore(): Promise<{ root: string; store: LocalMemoryStore }> {
    const root = await mkdtemp(join(tmpdir(), 'bibi-memory-'))
    temporaryDirectories.push(root)
    return { root, store: new LocalMemoryStore(root) }
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) => rm(directory, { recursive: true, force: true }))
    )
})

describe('本地 Markdown 记忆', () => {
    it('缺少文件时返回空记忆', async () => {
        const { store } = await createStore()
        const document = await store.readMemory('user-1', 'profile')

        expect(document.exists).toBe(false)
        expect(document.content).toBe('')
        expect(document.lastDistilledUserMessageCount).toBe(0)
    })

    it('按用户和类型隔离写入 Markdown 文件', async () => {
        const { root, store } = await createStore()
        await store.writeMemory('user-1', 'profile', '# 用户画像\n\n- 城市：上海')
        await store.writeMemory('user-2', 'profile', '# 用户画像\n\n- 城市：北京')

        expect((await store.readMemory('user-1', 'profile')).content).toContain('上海')
        expect((await store.readMemory('user-2', 'profile')).content).toContain('北京')
        const userDirectories = await readdir(root)
        expect(userDirectories).toHaveLength(2)
        for (const directory of userDirectories) {
            expect(await readdir(join(root, directory))).toEqual(['profile.md'])
        }
    })

    it('手动覆盖灵魂时保留自动提炼进度', async () => {
        const { store } = await createStore()
        await store.writeMemory('user-1', 'soul', '# 灵魂\n\n初始内容', {
            lastDistilledUserMessageCount: 10
        })
        await store.writeMemory('user-1', 'soul', '# 灵魂\n\n最新内容')

        const document = await store.readMemory('user-1', 'soul')
        expect(document.content).toContain('最新内容')
        expect(document.lastDistilledUserMessageCount).toBe(10)
    })
})
