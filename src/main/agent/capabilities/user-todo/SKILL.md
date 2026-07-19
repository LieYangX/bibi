---
name: user-todo
displayName: 待办管理
description: 帮用户创建、查询、修改、删除待办事项。
version: 1.0
author: system
---

# 待办管理 Skill

本 Skill 为原子型，工具可直接调用，无需先 getSkill。

## 使用规则

1. 所有工具已绑定当前用户，不传用户 ID。
2. 删除/修改时优先用 ID，无 ID 时用标题关键字模糊匹配。
3. 模糊匹配多条结果时，返回列表让用户选择，不自动猜测。
4. 创建待办时如用户未指定截止日期，不主动设置。
5. 查询时默认返回全部状态，用户要求“未完成”时才过滤为 pending。
