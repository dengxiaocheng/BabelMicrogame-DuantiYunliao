# MECHANIC_SPEC: 断梯运料

## Primary Mechanic

- mechanic: 格子路径 + 负重 + 承压稳定
- primary_input: 在脚手架格子上规划路线并选择携带负重
- minimum_interaction: 玩家必须选择材料负重并逐格移动，踩踏会改变脚手架稳定和坠落风险

## Phase Flow（引擎阶段机）

| Phase | 入口操作 | 出口 |
|---|---|---|
| `select_materials` | 玩家点选材料卡片 | → `plan_route` 或 `event`(load事件) |
| `plan_route` | 玩家查看格子布局 | → `move`(确认路线) |
| `move` | 玩家点击相邻格移动 | → `event` / `arrived` / `accident` |
| `event` | 玩家选择事件选项 | → 返回 move 或 arrived |
| `arrived` | 到达卸货点自动触发 | → `event`(arrive事件) 或停留 |
| `accident` | 超时或 risk 过高触发 | → `round_end` |
| `round_end` | 玩家主动结束或事故后 | → `next_round` 或 `game_over` |
| `game_over` | 第 4 轮结束 | 结束 |

## Mechanic Steps

### Step 1: 选材（select_materials）
- 玩家从 8 种材料中选取，形成 `load[]` 和 `loadWeight`
- 选材后可能触发 load 类事件

### Step 2: 移动（move）
每步移动结算公式（参考值，可微调）：

- **体力消耗**：`staminaCost = 1 + floor(loadWeight / 2)`
- **格子耐久消耗**：`drain = scaffold.baseDrain × (1 + loadWeight) - totalStability(load)`
- **整体稳定性**：`scaffoldStability = Σ(grid当前耐久) / Σ(模板耐久) × 100`
- **格子断裂**：`grid[ny][nx] = 0` 时 risk += 3
- **体力低耦合**：`stamina ≤ 3` 时 risk += 1
- **稳定低耦合**：`scaffoldStability < 30` 时 risk += 1
- **负重压力**：`pressure += floor(loadWeight / 3)`

### Step 3: 到达卸货点（arrived）
- `deliveryProgress = (deliveries / endpoints.length) × 100`
- 材料价值累加到 `resource`
- 清空 load 和 loadWeight
- 可能触发 arrive 类事件

### Step 4: 事故（accident）
- 触发条件：`turn >= scaffold.turnLimit` 或 `risk ≥ 15`
- 事故后直接进入 `round_end`

## State Coupling

每次有效操作必须同时推动两类后果：

- **生存/资源/进度压力**：stamina 下降、deliveryProgress 推进、resource 变化
- **关系/风险/秩序压力**：scaffoldStability 下降、risk 上升、pressure 上升、relation 变化

这一耦合在 moveStep 中通过以下链路实现：
```
移动 → stamina↓ (生存) + grid耐久↓ → scaffoldStability↓ (秩序)
     → 负重 → pressure↑ (秩序) + 可能 risk↑ (风险)
     → 体力低/risk高 → 耦合 risk↑ (交叉)
```

## Risk/Reward Curve

- 高 loadWeight = 高 resource 收益 + 高 stamina 消耗 + 高 grid 耐久消耗 + 高 risk
- 低 loadWeight = 安全但需多次往返，受 turnLimit 压力
- 核心决策：每次运多少材料，走哪条路

## Not A Choice List

- 不能只展示 2–4 个文字按钮让玩家选择
- UI worker 必须把 primary input 映射到场景对象操作（点格子、点材料卡片）
- integration worker 必须让这个操作进入状态结算，而不是只写叙事反馈
