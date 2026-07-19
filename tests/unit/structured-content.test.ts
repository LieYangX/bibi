import { describe, expect, it } from 'vitest'
import { parseStructuredContent } from '../../src/renderer/src/utils/structured-content'

describe('parseStructuredContent 结构化内容解析', () => {
    it('纯文本返回单个 text 片段', () => {
        const result = parseStructuredContent('你好，这是一段普通文本。')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('text')
        expect(result[0].text).toBe('你好，这是一段普通文本。')
    })

    it('解析 bibi-table 块', () => {
        const content = [
            '以下是本月支出：',
            '```bibi-table',
            '{"columns": ["分类", "金额"], "rows": [["餐饮", "1280"], ["交通", "560"]], "title": "本月支出"}',
            '```',
            '餐饮占比较大。'
        ].join('\n')

        const result = parseStructuredContent(content)
        expect(result).toHaveLength(3)
        expect(result[0].type).toBe('text')
        expect(result[0].text).toContain('以下是本月支出')
        expect(result[1].type).toBe('structured')
        expect(result[1].entry?.data_type).toBe('table')
        if (result[1].entry?.data_type === 'table') {
            expect(result[1].entry.data.columns).toEqual(['分类', '金额'])
            expect(result[1].entry.data.rows).toHaveLength(2)
            expect(result[1].entry.data.title).toBe('本月支出')
        }
        expect(result[2].type).toBe('text')
        expect(result[2].text).toContain('餐饮占比较大')
    })

    it('解析 bibi-chart 饼图块', () => {
        const content = [
            '```bibi-chart',
            '{"type": "pie", "labels": ["餐饮", "交通"], "datasets": [{"name": "支出", "values": [1280, 560]}], "title": "支出分布"}',
            '```'
        ].join('\n')

        const result = parseStructuredContent(content)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('structured')
        expect(result[0].entry?.data_type).toBe('chart')
        if (result[0].entry?.data_type === 'chart') {
            expect(result[0].entry.data.type).toBe('pie')
            expect(result[0].entry.data.labels).toHaveLength(2)
            expect(result[0].entry.data.datasets[0].values).toEqual([1280, 560])
        }
    })

    it('解析 bibi-chart 柱状图块', () => {
        const content = [
            '```bibi-chart',
            '{"type": "bar", "labels": ["1月", "2月"], "datasets": [{"name": "支出", "values": [3200, 2800]}], "title": "月度趋势"}',
            '```'
        ].join('\n')

        const result = parseStructuredContent(content)
        expect(result[0].entry?.data_type).toBe('chart')
        if (result[0].entry?.data_type === 'chart') {
            expect(result[0].entry.data.type).toBe('bar')
        }
    })

    it('解析 bibi-card 块', () => {
        const content = [
            '```bibi-card',
            '{"title": "账户总览", "fields": [{"label": "总资产", "value": "12,580"}, {"label": "本月支出", "value": "3,240", "color": "negative"}]}',
            '```'
        ].join('\n')

        const result = parseStructuredContent(content)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('structured')
        expect(result[0].entry?.data_type).toBe('card')
        if (result[0].entry?.data_type === 'card') {
            expect(result[0].entry.data.fields).toHaveLength(2)
            expect(result[0].entry.data.fields[1].color).toBe('negative')
        }
    })

    it('多个结构化块混合文本', () => {
        const content = [
            '总览如下：',
            '```bibi-card',
            '{"fields": [{"label": "总收入", "value": "8,500", "color": "positive"}]}',
            '```',
            '详细分类：',
            '```bibi-table',
            '{"columns": ["分类", "金额"], "rows": [["工资", "8500"]]}',
            '```'
        ].join('\n')

        const result = parseStructuredContent(content)
        expect(result).toHaveLength(4)
        expect(result[0].type).toBe('text')
        expect(result[1].type).toBe('structured')
        expect(result[1].entry?.data_type).toBe('card')
        expect(result[2].type).toBe('text')
        expect(result[3].type).toBe('structured')
        expect(result[3].entry?.data_type).toBe('table')
    })

    it('无效 JSON 回退为文本', () => {
        const content = ['```bibi-table', '{invalid json}', '```'].join('\n')

        const result = parseStructuredContent(content)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('text')
    })

    it('空字符串返回空文本片段', () => {
        const result = parseStructuredContent('')
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('text')
        expect(result[0].text).toBe('')
    })

    it('不认识的 bibi-xxx 标签也回退为文本', () => {
        const content = ['```bibi-unknown', '{"some": "data"}', '```'].join('\n')

        const result = parseStructuredContent(content)
        expect(result).toHaveLength(1)
        expect(result[0].type).toBe('text')
    })
})
