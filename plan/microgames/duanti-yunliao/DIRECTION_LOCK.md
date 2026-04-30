# Direction Lock: 断梯运料

## One Sentence
玩家在破损脚手架上搬运建材，负重越大效率越高，但坠落和塌架风险越大。

## Core Loop
1. 执行核心循环：选择材料组合 → 规划路线 → 移动 → 消耗体力和脚手架耐久 → 到达卸货点或事故发生
2. 按 4 轮节奏推进：短路线 → 破格和加固 → 多目标运料 → 限时抢运和高风险近路

## Must Keep
- 核心机制必须保持：格子路径 + 负重 + 承压稳定
- 核心循环必须保持：选择材料组合 → 规划路线 → 移动 → 消耗体力和脚手架耐久 → 到达卸货点或事故发生
- 4 轮结构只作为节奏，不扩成大项目

## Must Not Add
- 不加战斗、不加开放地图；核心是负重路径规划
- 不新增第二套主循环
- 不把小游戏扩成长期经营或开放世界

## Required State

| Direction Lock 名称 | 代码字段 | 类型 | 范围 | 默认值 |
|---|---|---|---|---|
| load | `load` / `loadWeight` | string[] + int | 材料ID列表 / 重量和 | [] / 0 |
| stamina | `stamina` | int | 0–20 | 20 |
| scaffold_stability | `scaffoldStability` | int | 0–100 | 100 |
| fall_risk | `risk` | int | 0–20 | 0 |
| delivery_progress | `deliveryProgress` | int | 0–100 | 0 |

附加状态（支撑核心循环但非 Direction Lock 主状态）：
- `resource`（0–50）：累计资源得分，到达卸货点时增加
- `pressure`（0–20）：工期压力，负重和事件推动
- `relation`（0–10）：工友关系，事件选择推动

## Phase Flow

```
select_materials → plan_route → move ⇄ event → arrived/accident
     ↑                                    |
     └── continue_after_delivery ─────────┘
                                          → round_end → next_round → [重复]
                                                        → game_over (round 4 后)
```

## Success
在 4 轮限定内完成主循环，并稳定进入至少一个可结算结局

## Failure
关键状态崩溃（risk ≥ 15 或 stamina = 0 持续），或在本轮主循环中被系统淘汰
