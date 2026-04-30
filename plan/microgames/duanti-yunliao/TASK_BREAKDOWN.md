# TASK_BREAKDOWN: 断梯运料

## Worker Dependency Graph

```
foundation ──→ state ──→ content ──→ ui ──→ integration ──→ qa
```

每个后续 worker 依赖前序 worker 的产出。

---

## 1. `duanti-yunliao-foundation`

- lane: foundation
- level: M
- goal: 建立只服务核心循环的可运行骨架：选材 → 确认路线 → 逐格移动 → 到达卸货点或事故
- **如何服务 primary input**：建立 Phase 流转和格子数据结构，使 UI 层能渲染可点击的格子
- **文件范围**：`src/game.ts`, `src/main.ts`, `src/content/scaffolds.ts`（模板数据）
- **验收标准**：
  - `createGame()` 返回合法 GameState，round=1, phase=`select_materials`
  - `moveStep(dx, dy)` 能更新 pos 和 grid 耐久
  - 到达 endpoint 触发 phase=`arrived`
  - `runSkeletonPlaythrough()` 控制台跑通不报错
- **禁止跑偏**：
  - 不加事件系统（留给 content worker）
  - 不加 UI 渲染（留给 ui worker）
  - 不修改 plan/ 目录

---

## 2. `duanti-yunliao-state`

- lane: logic
- level: M
- goal: 实现 Direction Lock 五个 Required State 的初始化、每步结算和跨轮保留逻辑
- **如何服务 primary input**：确保每次格子点击都同时推动生存压力和风险压力（State Coupling）
- **文件范围**：`src/game.ts`（核心结算逻辑）
- **验收标准**：
  - 五个 Required State 初始化符合 DIRECTION_LOCK.md 范围和默认值
  - `moveStep` 同时消耗 stamina（生存）和 scaffoldStability/risk（风险）
  - `stamina ≤ 3` 时 risk 增加（交叉耦合）
  - `scaffoldStability < 30` 时 risk 增加（交叉耦合）
  - 跨轮保留 resource/pressure/risk/relation，重置 stamina/scaffoldStability/deliveryProgress
  - `resolveCycle()` 返回结构化结算结果
- **禁止跑偏**：
  - 不改 Phase 流转（foundation 已定）
  - 不改格子数据结构
  - 不修改 plan/ 目录

---

## 3. `duanti-yunliao-content`

- lane: content
- level: M
- goal: 用材料目录、事件池和脚手架模板强化「格子路径 + 负重 + 承压稳定」
- **如何服务 primary input**：材料三角（重量/收益/稳定）驱动选材决策；事件在移动中制造取舍压力
- **文件范围**：`src/content/materials.ts`, `src/content/events.ts`, `src/content/scaffolds.ts`
- **验收标准**：
  - 8 种材料覆盖轻/中/重三档，各有独特稳定修正和特殊效果
  - 12+ 条事件覆盖 5 种 trigger，每条 2 选项驱动贪心 vs 谨慎
  - 4 张脚手架模板对应 4 轮，每张有不同的 grid/start/endpoints/baseDrain/turnLimit
  - 事件只操作 resource/pressure/risk/relation，不绕过核心机制
- **禁止跑偏**：
  - 不加与搬运无关的事件
  - 不改 Phase 机或结算公式
  - 不修改 plan/ 目录

---

## 4. `duanti-yunliao-ui`

- lane: ui
- level: M
- goal: 让玩家看见核心压力、可选操作和后果反馈
- **如何服务 primary input**：将 select_materials/map_route/move 映射到材料卡片点击和格子点击
- **文件范围**：`src/ui/GameUI.ts`
- **验收标准**：
  - select_materials 阶段：8 张材料卡片可多选，显示重量/价值/稳定修正
  - move 阶段：格子网格可点击相邻格，格子颜色实时反映耐久
  - 5 个 Required State 用进度条+数值实时呈现
  - 事件用覆盖层呈现 2 选项，显示 effects 摘要
  - arrived/accident/round_end/game_over 各有对应操作按钮
  - 首屏至少有一个可操作的场景对象
- **禁止跑偏**：
  - 不用纯文字按钮列表替代格子交互
  - 不加地图/战斗等非核心 UI
  - 不改游戏引擎逻辑
  - 不修改 plan/ 目录

---

## 5. `duanti-yunliao-integration`

- lane: integration
- level: M
- goal: 把已有 state/content/ui 接成单一主循环，确保 ACCEPTANCE_PLAYTHROUGH 可试玩
- **如何服务 primary input**：打通选材→确认→移动→事件→到达→结算的完整链路
- **文件范围**：`src/main.ts`, `src/game.ts`（如需修复集成问题）
- **验收标准**：
  - 浏览器打开后能完成 ACCEPTANCE_PLAYTHROUGH.md 的 Round 1 全流程
  - 4 轮完整流程可走通到 game_over
  - 每步操作产生即时可见反馈（格子颜色变化、状态条更新、消息栏文本）
  - UIAction 全部正确分发到游戏引擎
  - `runSkeletonPlaythrough()` 控制台跑通不报错
- **禁止跑偏**：
  - 不新增材料/事件/模板（用已有 content）
  - 不改 Direction Lock 定义的状态范围
  - 不修改 plan/ 目录

---

## 6. `duanti-yunliao-qa`

- lane: qa
- level: S
- goal: 用测试和 scripted playthrough 确认方向没跑偏
- **如何服务 primary input**：验证每次格子点击都正确推动核心循环
- **文件范围**：`src/game.test.ts`
- **验收标准**：
  - 覆盖 ACCEPTANCE_PLAYTHROUGH.md 的每一步（Round 1 + 4 轮完整流程）
  - 覆盖 4 个 edge case（体力耗尽/格子断裂/超时事故/高风险事件链）
  - 验证 State Coupling：每次 moveStep 同时改变生存压力和风险压力
  - 验证五个 Required State 初始化、范围和结算
  - 全部测试通过（`npm test`）
- **禁止跑偏**：
  - 不改游戏逻辑来通过测试
  - 不修改 plan/ 目录
