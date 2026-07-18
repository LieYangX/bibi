/**
 * 默认预设分类模板
 * 新用户首次启动时自动加载
 * @author xiangwei
 */

/** 单个一级分类定义 */
export interface PresetCategory {
    name: string
    icon: string
    color: string
    subCategories: string[]
}

/**
 * 默认分类调色板（15色，对应 10 支出 + 5 收入）
 */
export const CATEGORY_COLORS: string[] = [
    '#EF4444',
    '#F97316',
    '#EAB308',
    '#22C55E',
    '#14B8A6',
    '#06B6D4',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#D946EF',
    '#EC4899',
    '#F43F5E',
    '#059669',
    '#0284C7',
    '#7C3AED'
]

/**
 * 预设支出分类（一级 → 二级）
 * 覆盖日常记账高频场景，二级分类粒度适中而非细碎
 */
export const DEFAULT_EXPENSE_CATEGORIES: PresetCategory[] = [
    {
        name: '餐饮',
        icon: 'IconBook',
        color: '#EF4444',
        subCategories: ['早餐', '午餐', '晚餐', '零食饮料', '外卖', '聚餐']
    },
    {
        name: '交通',
        icon: 'IconBook',
        color: '#F97316',
        subCategories: ['公交地铁', '打车', '加油', '停车过路', '火车机票']
    },
    {
        name: '居家',
        icon: 'IconBook',
        color: '#EAB308',
        subCategories: ['房租房贷', '水电燃气', '物业', '宽带', '家居维修']
    },
    {
        name: '购物',
        icon: 'IconBook',
        color: '#22C55E',
        subCategories: ['服饰鞋包', '数码电子', '日杂日用品', '美妆护肤']
    },
    {
        name: '娱乐',
        icon: 'IconBook',
        color: '#14B8A6',
        subCategories: ['影音', '游戏', '运动健身', '旅行']
    },
    {
        name: '医疗',
        icon: 'IconBook',
        color: '#06B6D4',
        subCategories: ['门诊挂号', '药品', '体检', '保险']
    },
    {
        name: '人情',
        icon: 'IconBook',
        color: '#3B82F6',
        subCategories: ['礼金红包', '请客', '孝敬父母', '借贷']
    },
    {
        name: '教育',
        icon: 'IconBook',
        color: '#6366F1',
        subCategories: ['书籍', '培训课程', '考试']
    },
    {
        name: '通讯',
        icon: 'IconBook',
        color: '#8B5CF6',
        subCategories: ['话费', '流量']
    },
    {
        name: '其他支出',
        icon: 'IconBook',
        color: '#D946EF',
        subCategories: []
    }
]

/**
 * 预设收入分类
 */
export const DEFAULT_INCOME_CATEGORIES: PresetCategory[] = [
    {
        name: '工资',
        icon: 'IconBook',
        color: '#EC4899',
        subCategories: ['基本工资', '奖金', '津贴补贴']
    },
    {
        name: '兼职',
        icon: 'IconBook',
        color: '#F43F5E',
        subCategories: ['副业收入', '劳务报酬']
    },
    {
        name: '理财',
        icon: 'IconBook',
        color: '#059669',
        subCategories: ['利息', '股基收益', '分红']
    },
    {
        name: '报销退款',
        icon: 'IconBook',
        color: '#0284C7',
        subCategories: ['报销', '退款', '红包礼金']
    },
    {
        name: '其他收入',
        icon: 'IconBook',
        color: '#7C3AED',
        subCategories: []
    }
]
