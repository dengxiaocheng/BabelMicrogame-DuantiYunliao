# TASKS: 断梯运料

本文件保留给旧入口兼容；任务真源见 `TASK_BREAKDOWN.md`。

# TASK_BREAKDOWN: 断梯运料

## Standard Worker Bundle

1. `duanti-yunliao-foundation`
   - lane: foundation
   - level: M
   - goal: 建立只服务「选择材料组合 -> 规划路线 -> 移动 -> 消耗体力和脚手架耐久 -> 到达卸货点或事故发生」的可运行骨架

2. `duanti-yunliao-state`
   - lane: logic
   - level: M
   - goal: 实现 Direction Lock 状态的一次分配/操作结算

3. `duanti-yunliao-content`
   - lane: content
   - level: M
   - goal: 用事件池强化「格子路径 + 负重 + 承压稳定」

4. `duanti-yunliao-ui`
   - lane: ui
   - level: M
   - goal: 让玩家看见核心压力、可选操作和后果反馈

5. `duanti-yunliao-integration`
   - lane: integration
   - level: M
   - goal: 把已有 state/content/ui 接成单一主循环

6. `duanti-yunliao-qa`
   - lane: qa
   - level: S
   - goal: 用测试和 scripted playthrough 确认方向没跑偏
