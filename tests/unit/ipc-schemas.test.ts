import { describe, expect, it } from 'vitest'
import { IPC_SCHEMAS } from '../../src/shared/ipc/schemas'

describe('IPC 参数契约', () => {
    it('拒绝非法金额和未知字段', () => {
        expect(() =>
            IPC_SCHEMAS.transaction.create.parse([
                {
                    type: 'expense',
                    account_id: 'account-1',
                    amount_cents: 0,
                    date: '2026-07-11',
                    unexpected: true
                }
            ])
        ).toThrow()
    })

    it('接受有效的交易筛选参数', () => {
        expect(
            IPC_SCHEMAS.transaction.list.parse([
                { type: 'expense', page: 1, page_size: 50, sort_order: 'desc' }
            ])
        ).toEqual([{ type: 'expense', page: 1, page_size: 50, sort_order: 'desc' }])
        expect(
            IPC_SCHEMAS.transaction.list.parse([
                {
                    page_size: 50,
                    cursor: { date: '2026-07-11', id: 'transaction-1' }
                }
            ])
        ).toEqual([
            {
                page_size: 50,
                cursor: { date: '2026-07-11', id: 'transaction-1' }
            }
        ])
    })

    it('批量删除限制数量并拒绝重复 ID', () => {
        expect(
            IPC_SCHEMAS.transaction.batchDelete.parse([['transaction-1', 'transaction-2']])
        ).toEqual([['transaction-1', 'transaction-2']])
        expect(() =>
            IPC_SCHEMAS.transaction.batchDelete.parse([['transaction-1', 'transaction-1']])
        ).toThrow()
    })

    it('拒绝不存在的日期和倒置的筛选区间', () => {
        expect(() =>
            IPC_SCHEMAS.transaction.create.parse([
                {
                    type: 'expense',
                    account_id: 'account-1',
                    amount_cents: 100,
                    date: '2026-02-31'
                }
            ])
        ).toThrow()
        expect(() =>
            IPC_SCHEMAS.transaction.list.parse([
                { start_date: '2026-07-12', end_date: '2026-07-11' }
            ])
        ).toThrow()
    })

    it('拒绝脱离一级分类的二级分类', () => {
        expect(() =>
            IPC_SCHEMAS.transaction.create.parse([
                {
                    type: 'expense',
                    account_id: 'account-1',
                    sub_category_id: 'sub-category-1',
                    amount_cents: 100,
                    date: '2026-07-11'
                }
            ])
        ).toThrow()
    })

    it('接受导入草稿映射操作并拒绝空行更新', () => {
        const data = {
            draft_id: 'draft-1',
            revision: 2,
            operation: {
                kind: 'map-category' as const,
                item_type: 'expense' as const,
                source_category: '餐饮美食',
                category_id: 'category-1',
                sub_category_id: null
            }
        }

        expect(IPC_SCHEMAS.import.updateDraft.parse([data])).toEqual([data])
        expect(() =>
            IPC_SCHEMAS.import.updateDraft.parse([
                {
                    draft_id: 'draft-1',
                    revision: 2,
                    operation: { kind: 'update-item', item_id: 'item-1', changes: {} }
                }
            ])
        ).toThrow()
    })

    it('限制 Agent 消息、语音模型和音频缓冲区', () => {
        expect(IPC_SCHEMAS.agent.connectWechat.parse([])).toEqual([])
        expect(IPC_SCHEMAS.agent.disconnectWechat.parse([])).toEqual([])
        expect(IPC_SCHEMAS.agent.getWechatStatus.parse([])).toEqual([])
        expect(() => IPC_SCHEMAS.agent.connectWechat.parse(['unexpected'])).toThrow()
        expect(IPC_SCHEMAS.agent.chat.parse([null, '帮我分析本月支出', false])).toEqual([
            null,
            '帮我分析本月支出',
            false
        ])
        expect(() => IPC_SCHEMAS.agent.chat.parse([null, '帮我分析本月支出'])).toThrow()
        expect(() => IPC_SCHEMAS.agent.chat.parse([null, '   ', true])).toThrow()
        expect(() => IPC_SCHEMAS.agent.sttDeleteModel.parse(['../../documents'])).toThrow()
        expect(() => IPC_SCHEMAS.agent.transcribeAudio.parse([new ArrayBuffer(3)])).toThrow()
        expect(IPC_SCHEMAS.agent.sttDownloadModel.parse(['Xenova/whisper-base'])).toEqual([
            'Xenova/whisper-base'
        ])
    })

    it('记忆提炼阈值只接受一到五十的整数', () => {
        expect(IPC_SCHEMAS.agent.updateConfig.parse([{ memoryDistillationThreshold: 10 }])).toEqual(
            [{ memoryDistillationThreshold: 10 }]
        )
        expect(() =>
            IPC_SCHEMAS.agent.updateConfig.parse([{ memoryDistillationThreshold: 0 }])
        ).toThrow()
        expect(() =>
            IPC_SCHEMAS.agent.updateConfig.parse([{ memoryDistillationThreshold: 51 }])
        ).toThrow()
        expect(() =>
            IPC_SCHEMAS.agent.updateConfig.parse([{ memoryDistillationThreshold: 1.5 }])
        ).toThrow()
    })

    it('接受有效 MCP 配置并拒绝危险协议和无效请求头', () => {
        const server = {
            name: 'exa',
            url: 'https://mcp.exa.ai/mcp',
            headers: { Authorization: 'Bearer token' },
            enabled: true
        }
        expect(IPC_SCHEMAS.agent.saveMcpServer.parse([server])).toEqual([server])
        expect(() =>
            IPC_SCHEMAS.agent.saveMcpServer.parse([
                { ...server, url: 'file:///C:/Users/test/config.json' }
            ])
        ).toThrow()
        expect(() =>
            IPC_SCHEMAS.agent.saveMcpServer.parse([{ ...server, headers: { Authorization: 123 } }])
        ).toThrow()
    })

    it('天气接口只接受可选的强制刷新标记', () => {
        expect(IPC_SCHEMAS.weather.getCurrent.parse([undefined])).toEqual([undefined])
        expect(IPC_SCHEMAS.weather.getCurrent.parse([true])).toEqual([true])
        expect(() => IPC_SCHEMAS.weather.getCurrent.parse(['true'])).toThrow()
    })

    it('通用设置接口只允许渲染进程使用的公开键和值', () => {
        expect(IPC_SCHEMAS.setting.get.parse(['amount_mask', true])).toEqual(['amount_mask', true])
        expect(IPC_SCHEMAS.setting.set.parse(['amount_mask', true])).toEqual(['amount_mask', true])
        expect(() => IPC_SCHEMAS.setting.set.parse(['agent_api_key', 'secret'])).toThrow()
        expect(() => IPC_SCHEMAS.setting.set.parse(['stt_model', '../../documents'])).toThrow()
    })
})
