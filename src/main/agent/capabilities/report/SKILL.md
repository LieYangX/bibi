---
name: report
displayName: 报告生成
description: 生成周报、月报、年报等结构化财务报告。适合“给我生成报告”“总结一下这周/月/年”的场景。
version: 1.0
author: system
---

# 报告生成 Skill

## 可用工具

按需选择，所有数据必须通过工具获取，不自编：

- 查询：queryMonthlySummary、queryYearlySummary、queryCategorySummary、queryAccountBalance、queryBudgetProgress
- 计算：compareValues（环比/同比变化）、summarize（汇总统计）、convertCentsToYuan（单位换算）

## 报告模板

### 周报

- 本周总支出 / 总收入 / 结余
- 日均支出
- 支出分类 Top 3
- 与上周对比（使用 compareValues 计算百分比变化）
- 本周消费特点总结

### 月报

- 本月总支出 / 总收入 / 结余
- 账户总余额
- 支出分类占比
- 月度支出趋势
- 预算执行情况
- 与上月对比（使用 compareValues）
- 消费建议（1-2 条）

### 年报

- 年度总收入 / 总支出 / 结余
- 各月支出趋势
- 年度分类占比 Top 5
- 与去年对比（使用 compareValues）
- 年度财务健康度评价
- 下一年建议

## 使用规则

1. 所有数据通过查询工具获取，所有计算通过计算工具完成
2. 报告简洁，突出关键信息
3. 金额用“元”展示
4. 分析性结论末尾加“仅供参考”
