import { describe, expect, it } from 'vitest'
import { parseBillRecords, type BillRecord } from '../../src/main/services/import-bill-parser'

const ALIPAY_HEADER = [
    '\uFEFF交易时间',
    '交易分类',
    '交易对方',
    '对方账号',
    '商品说明',
    '收/支',
    '金额',
    '收/付款方式',
    '交易状态',
    '交易订单号',
    '商家订单号',
    '备注'
]

const WECHAT_HEADER = [
    '交易时间',
    '交易类型',
    '交易对方',
    '商品',
    '收/支',
    '金额(元)',
    '支付方式',
    '当前状态',
    '交易单号',
    '商户单号',
    '备注'
]

describe('真实账单纯解析', () => {
    it('从支付宝第 24 行动态定位表头并保留分类、账户和订单号', () => {
        const records: BillRecord[] = [
            ...Array.from({ length: 23 }, (_, index) => [`支付宝账单说明 ${index + 1}`]),
            ALIPAY_HEADER,
            [
                "'2026-07-10 12:30:00'",
                "'餐饮美食'",
                "'示例餐厅'",
                "'merchant@example.com'",
                "'午餐套餐'",
                "'支出'",
                "'12.345'",
                "'招商银行信用卡(1234)&支付宝红包'",
                "'交易成功'",
                "'202607100000000001'",
                "'M20260710001'",
                "'示例餐厅'"
            ]
        ]

        expect(parseBillRecords(records, 'alipay')).toEqual([
            {
                type: 'expense',
                default_included: true,
                exclusion_reason: null,
                date: '2026-07-10',
                time: '12:30',
                amount_cents: 1235,
                note: '示例餐厅 · 午餐套餐',
                source_category: '餐饮美食',
                source_transaction_type: '',
                source_direction: '支出',
                source_status: '交易成功',
                source_account_raw: '招商银行信用卡(1234)&支付宝红包',
                source_account_key: '招商银行信用卡(1234)',
                counterparty: '示例餐厅',
                product: '午餐套餐',
                external_transaction_id: '202607100000000001'
            }
        ])
    })

    it('将支付宝退款成功映射为收入，并默认排除关闭、未知和不计收支记录', () => {
        const records: BillRecord[] = [
            ALIPAY_HEADER,
            [
                '2026-07-01',
                '退款',
                '示例平台',
                '',
                '订单退款',
                '不计收支',
                '8.88',
                '/',
                '退款成功',
                'refund-001',
                '',
                ''
            ],
            [
                '2026-07-02',
                '服饰装扮',
                '示例商户',
                '',
                '已取消订单',
                '支出',
                '20.00',
                '支付宝红包',
                '交易关闭',
                'closed-001',
                '',
                ''
            ],
            [
                '2026-07-03',
                '其他',
                '示例用户',
                '',
                '账户互转',
                '不计收支',
                '30.00',
                '余额宝',
                '交易成功',
                'neutral-001',
                '',
                ''
            ],
            [
                '2026-07-04',
                '其他',
                '示例用户',
                '',
                '待确认交易',
                '待确认',
                '40.00',
                '余额宝',
                '交易成功',
                'unknown-001',
                '',
                ''
            ]
        ]

        const parsed = parseBillRecords(records, 'alipay')
        expect(
            parsed.map(({ type, default_included, exclusion_reason }) => ({
                type,
                default_included,
                exclusion_reason
            }))
        ).toEqual([
            { type: 'income', default_included: true, exclusion_reason: null },
            {
                type: 'skip',
                default_included: false,
                exclusion_reason: '交易状态为“交易关闭”'
            },
            { type: 'skip', default_included: false, exclusion_reason: '不计收支' },
            { type: 'skip', default_included: false, exclusion_reason: '无法识别收支方向' }
        ])
        expect(parsed[0].source_account_key).toBe('')
        expect(parsed[1].source_account_key).toBe('')
    })

    it('保留支付宝 0 元交易并标记为默认排除，供用户在确认页核对', () => {
        const records: BillRecord[] = [
            ALIPAY_HEADER,
            [
                '2026-07-05 09:30:00',
                '交通出行',
                '示例出行平台',
                '',
                '免单行程',
                '支出',
                '0.00',
                '余额宝&支付宝红包',
                '交易成功',
                'zero-amount-001',
                '',
                ''
            ]
        ]

        expect(parseBillRecords(records, 'alipay')).toEqual([
            {
                type: 'skip',
                default_included: false,
                exclusion_reason: '金额为 0',
                date: '2026-07-05',
                time: '09:30',
                amount_cents: 0,
                note: '示例出行平台 · 免单行程',
                source_category: '交通出行',
                source_transaction_type: '',
                source_direction: '支出',
                source_status: '交易成功',
                source_account_raw: '余额宝&支付宝红包',
                source_account_key: '余额宝',
                counterparty: '示例出行平台',
                product: '免单行程',
                external_transaction_id: 'zero-amount-001'
            }
        ])
    })

    it('解析微信 Date、数值金额和字符串订单号，并规范化收入零钱账户', () => {
        const records: BillRecord[] = [
            ...Array.from({ length: 17 }, (_, index) => [`微信账单说明 ${index + 1}`]),
            WECHAT_HEADER,
            [
                new Date('2026-07-09T08:00:00.000Z'),
                '二维码收付款',
                '客户甲',
                '项目款',
                '收入',
                88,
                '/',
                '已收钱',
                '0012345678901234567890',
                'merchant-001',
                '客户甲'
            ],
            [
                new Date('2026-07-10T09:30:00.000Z'),
                '商户消费',
                '示例商店',
                '日用品',
                '支出',
                15.25,
                '交通银行信用卡(8899)',
                '支付成功',
                'wx-expense-001',
                'merchant-002',
                ''
            ]
        ]

        const parsed = parseBillRecords(records, 'wechat')
        expect(parsed[0]).toMatchObject({
            type: 'income',
            default_included: true,
            date: '2026-07-09',
            amount_cents: 8800,
            source_category: '二维码收付款',
            source_transaction_type: '二维码收付款',
            source_account_raw: '/',
            source_account_key: '微信零钱',
            external_transaction_id: '0012345678901234567890'
        })
        expect(parsed[1]).toMatchObject({
            type: 'expense',
            amount_cents: 1525,
            source_account_key: '交通银行信用卡(8899)'
        })
    })

    it('使用本地日期解析微信凌晨交易，避免时区导致日期前移', () => {
        const records: BillRecord[] = [
            WECHAT_HEADER,
            [
                new Date(2026, 6, 9, 0, 5),
                '商户消费',
                '示例商店',
                '夜间消费',
                '支出',
                10,
                '零钱',
                '支付成功',
                'wx-midnight-001',
                '',
                ''
            ]
        ]

        expect(parseBillRecords(records, 'wechat')[0].date).toBe('2026-07-09')
    })

    it('将微信失败交易保留为默认排除记录', () => {
        const records: BillRecord[] = [
            WECHAT_HEADER,
            [
                new Date('2026-07-10T00:00:00.000Z'),
                '商户消费',
                '示例商户',
                '失败订单',
                '支出',
                1,
                '零钱通',
                '支付失败',
                'failed-001',
                '',
                ''
            ]
        ]

        expect(parseBillRecords(records, 'wechat')[0]).toMatchObject({
            type: 'skip',
            default_included: false,
            exclusion_reason: '交易状态为“支付失败”',
            source_account_key: '零钱通'
        })
    })

    it('备注按交易对方、商品和备注去重后截断到 500 字符', () => {
        const longRemark = '长'.repeat(600)
        const records: BillRecord[] = [
            ALIPAY_HEADER,
            [
                '2026-07-01',
                '其他',
                '重复内容',
                '',
                '重复内容',
                '支出',
                '1.00',
                '余额宝',
                '交易成功',
                'note-001',
                '',
                longRemark
            ]
        ]

        const [row] = parseBillRecords(records, 'alipay')
        expect(row.note.startsWith('重复内容 · ')).toBe(true)
        expect(row.note.length).toBe(500)
        expect(row.note.match(/重复内容/gu)).toHaveLength(1)
    })

    it('缺少来源必要表头时抛出中文错误', () => {
        expect(() => parseBillRecords([['日期', '金额']], 'wechat')).toThrow(
            '未找到微信账单必要表头'
        )
    })
})
