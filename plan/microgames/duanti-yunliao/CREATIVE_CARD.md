# CREATIVE_CARD: 断梯运料

- slug: `duanti-yunliao`
- creative_line: 断梯运料
- target_runtime: web
- target_minutes: 20
- core_emotion: 格子路径 + 负重 + 承压稳定
- core_loop: 选择材料组合 -> 规划路线 -> 移动 -> 消耗体力和脚手架耐久 -> 到达卸货点或事故发生
- failure_condition: 关键状态崩溃，或在本轮主循环中被系统淘汰
- success_condition: 在限定时长内完成主循环，并稳定进入至少一个可结算结局

## Intent

- 做一个 Babel 相关的单创意线微游戏
- 只保留一个主循环，不扩成大项目
- 让 Claude worker 能按固定 packet 稳定并行
