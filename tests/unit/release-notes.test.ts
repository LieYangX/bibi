import { describe, expect, it } from 'vitest'
import {
    getAllReleaseNotes,
    getReleaseNotes,
    hasReadReleaseNotes,
    markReleaseNotesRead,
    RELEASE_NOTES_DELAY_MS,
    type ReleaseNotesStorage
} from '../../src/renderer/src/app/release-notes'

/**
 * 创建内存版公告已读状态存储器
 *
 * @returns 内存存储器
 * @author xiangwei
 */
function createMemoryStorage(): ReleaseNotesStorage {
    const values = new Map<string, string>()
    return {
        getItem(key: string): string | null {
            return values.get(key) ?? null
        },
        setItem(key: string, value: string): void {
            values.set(key, value)
        }
    }
}

describe('版本更新公告', () => {
    it('为 3.0.4 提供完整更新内容', () => {
        const release = getReleaseNotes('3.0.4')

        expect(release?.date).toBe('2026-07-14')
        expect(release?.additions).toEqual([
            '小笔新增 MCP 服务管理，内置 Exa 网络检索服务。',
            'MCP 服务支持自定义新增、编辑、启停、删除和连接检测。',
            'AI 对话可同时调用本地 Skill 工具与已启用的 MCP 远程工具。',
            '工具面板新增 MCP 服务状态、远程工具列表和调用来源展示。',
            '设置页新增“更新内容”入口，可随时查看当前版本公告。',
            '首页顶部新增实时天气信息，自动展示当前位置、温度、湿度、风力和天气预警。'
        ])
        expect(release?.fixes).toEqual([
            '更新内容弹窗改为新版本首次进入五秒后展示，减少启动过程中的操作打断。',
            '增强远程工具异常隔离，单个 MCP 服务不可用时不影响本地技能和工具。',
            '优化工具调用结果展示，默认折叠并在用户展开时按需渲染，避免大数据量导致界面卡顿。',
            '优化语言转文字引擎加载时机导致界面卡顿的问题。'
        ])
        expect(RELEASE_NOTES_DELAY_MS).toBe(5_000)
    })

    it('历史版本公告包含发布日期', () => {
        expect(getReleaseNotes('3.0.3')?.date).toBe('2026-07-14')
    })

    it('全部公告按版本号从新到旧排列', () => {
        const releases = getAllReleaseNotes()

        expect(releases.map((release) => release.version)).toEqual(['3.0.4', '3.0.3'])
        expect(releases[0]?.version).toBe('3.0.4')
    })

    it('同一版本仅在首次进入时展示公告', () => {
        const release = getReleaseNotes('3.0.4')
        if (!release) throw new Error('3.0.4 更新公告不存在')

        const storage = createMemoryStorage()
        expect(hasReadReleaseNotes(storage, release)).toBe(false)

        markReleaseNotesRead(storage, release)
        expect(hasReadReleaseNotes(storage, release)).toBe(true)
    })

    it('未配置公告的版本不展示更新内容', () => {
        expect(getReleaseNotes('9.9.9')).toBeNull()
    })
})
