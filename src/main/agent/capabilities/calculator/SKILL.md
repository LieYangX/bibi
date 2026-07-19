---
name: calculator
displayName: 计算器
description: 执行精确的数学计算。所有涉及加减乘除、百分比、汇总统计、金额换算的任务都必须使用此 Skill 的工具，禁止口算。
version: 1.0
author: system
---

# 计算器 Skill

本 Skill 为原子型，工具可直接调用，无需先 getSkill。

## 使用规则

1. LLM 自身数学计算不可靠，任何计算都通过工具完成。
2. 多步计算拆分步骤，逐步调用合适工具。
3. 涉及百分比变化使用 compareValues，不口算。
4. 从数据库查到的分值先用 convertCentsToYuan 换算为元。
5. 汇总统计使用 summarize。
