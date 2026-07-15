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
    it('为 3.0.5 提供完整更新内容', () => {
        const release = getReleaseNotes('3.0.5')

        expect(release?.date).toBe('2026-07-14')
        expect(release?.additions).toEqual([
            '新增用户画像与灵魂两类本地 Markdown 记忆，AI 可按需维护用户画像。',
            '新增可配置的“记忆提炼阈值”，默认每 10 条用户消息自动更新一次灵魂。',
            '每次 AI 请求自动携带最新灵魂，并结合上次灵魂连续提炼情感和行为特征。',
            'Skill 上下文改为仅注入名称和描述，AI 可通过 getSkill 工具按需读取完整内容。',
            'AI 上下文采用与记忆提炼阈值一致的滑动窗口，并使用 AI SDK 消息裁剪工具控制长度。',
            '集成 AI SDK DevTools，支持开发环境调试和监控 AI 运行状态。',
            'AI 运行上下文新增操作系统、架构、应用版本、语言区域和时区信息。'
        ])
        expect(release?.fixes).toEqual([
            '修复进入小笔 AI 页面时未自动加载 MCP 状态，导致工具数量显示不准确的问题。',
            '重构 Skill 与工具架构：Skill 负责指导 AI 完成任务，工具独立向 AI 提供可调用能力和用途说明。',
            '统一本地运行数据路径：开发环境存放在项目根目录，打包后存放在用户数据目录。',
            '精简小笔系统提示词，减少重复上下文，并让回复更温柔、体贴且尊重用户边界。'
        ])
    })

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

        expect(releases.map((release) => release.version)).toEqual(['3.0.5', '3.0.4', '3.0.3'])
        expect(releases[0]?.version).toBe('3.0.5')
    })

    it('同一版本仅在首次进入时展示公告', () => {
        const release = getReleaseNotes('3.0.5')
        if (!release) throw new Error('3.0.5 更新公告不存在')

        const storage = createMemoryStorage()
        expect(hasReadReleaseNotes(storage, release)).toBe(false)

        markReleaseNotesRead(storage, release)
        expect(hasReadReleaseNotes(storage, release)).toBe(true)
    })

    it('未配置公告的版本不展示更新内容', () => {
        expect(getReleaseNotes('9.9.9')).toBeNull()
    })
})
