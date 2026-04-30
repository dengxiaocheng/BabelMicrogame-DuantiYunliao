# MINI_GDD: 断梯运料

## Scope

- runtime: web（浏览器单页）
- duration: 约 20 分钟（4 轮 × 约 5 分钟）
- project_line: 断梯运料
- single_core_loop: 选择材料组合 → 规划路线 → 移动 → 消耗体力和脚手架耐久 → 到达卸货点或事故发生

## Round Progression

| 轮次 | 脚手架名 | 格子尺寸 | 特点 |
|---|---|---|---|
| 1 | 初登架 | 5×5 | 单路径直线，1 个卸货点，教学 |
| 2 | 断裂带 | 6×6 | 多处断格需绕路，1 个卸货点 |
| 3 | 三面卸货 | 5×7 | 3 个卸货点，中心薄弱 |
| 4 | 最后的冲刺 | 6×9 | 远安全路 vs 近高风险路，1 个卸货点 |

每轮重置 `stamina=20`, `scaffoldStability=100`, `deliveryProgress=0`；跨轮保留 `resource`, `pressure`, `risk`, `relation`。

## Material Triangle

核心决策三角：**重量 ↔ 收益 ↔ 脚手架压力**

| 材料 | 重量 | 价值 | 稳定修正 | 特殊 |
|---|---|---|---|---|
| 工具箱 | 1 | 0 | +2 | 可修复格子 |
| 木板 | 2 | 1 | +1 | 踩过格子耐久+1 |
| 涂料桶 | 2 | 2 | 0 | 坠落时价值归零 |
| 砖块 | 3 | 2 | 0 | 标准建材 |
| 玻璃板 | 3 | 5 | -1 | 高风险高回报，坠落归零 |
| 水泥袋 | 4 | 3 | -1 | 重但值钱 |
| 管件 | 4 | 3 | -1 | 转向体力+1 |
| 钢筋 | 5 | 4 | -2 | 极重致命负担 |

玩家每次选 1–N 个材料，总重量即为 `loadWeight`。

## State

五个 Required State（详见 DIRECTION_LOCK.md）：
- load, stamina, scaffold_stability, fall_risk, delivery_progress

附加状态：resource, pressure, relation

## UI

- 主界面：脚手架格子网格 + 状态仪表盘 + 操作区
- 材料选择：卡片式点选
- 移动：点击相邻格子
- 事件：覆盖层呈现 2 选项
- 结算：轮次结果 + 最终结果
- 不加多余菜单和后台页

## Content

- 12 条事件池覆盖 5 种触发类型：move(4), load(2), arrive(2), collapse_risk(2), rest(2)
- 每条事件 2 选项，驱动贪心 vs 谨慎取舍
- 4 张脚手架模板驱动轮次变化

## Constraints

- 总体规模目标控制在 5000 行以内
- 单个 worker 任务必须服从 packet budget
- 如需扩线，交回 manager 重新拆
