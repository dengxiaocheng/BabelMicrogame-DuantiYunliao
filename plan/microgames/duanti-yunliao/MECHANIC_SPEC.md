# MECHANIC_SPEC: 断梯运料

## Primary Mechanic

- mechanic: 格子路径 + 负重 + 承压稳定
- primary_input: 在脚手架格子上规划路线并选择携带负重
- minimum_interaction: 玩家必须选择材料负重并逐格移动，踩踏会改变脚手架稳定和坠落风险

## Mechanic Steps

1. 选择材料组合形成 load
2. 在格子路径上移动
3. 每步消耗 stamina 和 scaffold_stability
4. 到达卸货点或触发 fall_risk

## State Coupling

每次有效操作必须同时推动两类后果：

- 生存/资源/进度压力：从 Required State 中选择至少一个直接变化
- 关系/风险/秩序压力：从 Required State 中选择至少一个直接变化

## Not A Choice List

- 不能只展示 2-4 个文字按钮让玩家选择
- UI worker 必须把 primary input 映射到场景对象操作
- integration worker 必须让这个操作进入状态结算，而不是只写叙事反馈
