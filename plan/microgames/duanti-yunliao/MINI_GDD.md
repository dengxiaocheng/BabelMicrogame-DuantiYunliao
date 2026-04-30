# MINI_GDD: 断梯运料

## Scope

- runtime: web
- duration: 20min
- project_line: 断梯运料
- single_core_loop: 选择材料组合 -> 规划路线 -> 移动 -> 消耗体力和脚手架耐久 -> 到达卸货点或事故发生

## Core Loop
1. 执行核心循环：选择材料组合 -> 规划路线 -> 移动 -> 消耗体力和脚手架耐久 -> 到达卸货点或事故发生
2. 按 20 分钟节奏推进：短路线 -> 破格和加固 -> 多目标运料 -> 限时抢运和高风险近路

## State

- load
- stamina
- scaffold_stability
- fall_risk
- delivery_progress

## UI

- 只保留主界面、结果反馈、结算入口
- 不加多余菜单和后台页

## Content

- 用小型事件池支撑主循环
- 一次只验证一条 Babel 创意线

## Constraints

- 总体规模目标控制在 5000 行以内
- 单个 worker 任务必须服从 packet budget
- 如需扩线，交回 manager 重新拆
