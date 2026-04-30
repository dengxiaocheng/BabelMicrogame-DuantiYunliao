# ACCEPTANCE_PLAYTHROUGH: 断梯运料

## Minimum Playable Script

以下脚本描述了验收时必须可执行的完整主循环。
对应代码入口：`runSkeletonPlaythrough()` 或浏览器交互。

### Round 1: 初登架

**Step 1: 初始化**
- 操作：启动游戏
- 验证：round=1, phase=`select_materials`, stamina=20, scaffoldStability=100, risk=0, deliveryProgress=0
- 验证：脚手架格子网格显示，卸货点标记可见

**Step 2: 选择材料**
- 操作：点击"砖块"卡片，点击"木板"卡片 → 点击"确认选材"
- 验证：load=['brick','plank'], loadWeight=5
- 验证：phase 变为 `plan_route` 或 `event`（若触发 load 事件）

**Step 3: 确认路线**
- 操作：若在 plan_route → 点击"确认路线，出发"
- 验证：phase=`move`

**Step 4: 逐步移动**
- 操作：点击相邻格子移动 4 步到 (2,4)
- 每步验证：
  - stamina 减少（1 + floor(5/2) = 3/步）
  - grid 目标格子耐久下降
  - scaffoldStability 从 100 开始下降
- 可能触发 move 事件 → 选择选项 → 应用 effects → 回到 move

**Step 5: 到达卸货点**
- 验证：pos=(2,4) 触发 phase=`arrived`
- 验证：deliveryProgress=100（1 endpoint，1 delivery）
- 验证：resource 增加（brick.value=2 + plank.value=1 = 3）
- 验证：load=[], loadWeight=0
- 操作：点击"继续搬运" → phase=`select_materials`

**Step 6: 结束轮次**
- 操作：点击"结束轮次" → phase=`round_end`
- 操作：点击"进入第2轮" → round=2, phase=`select_materials`

### Round 2–4: 完整流程

**Step 7: 重复核心循环**
- 每轮：选材 → 确认 → 移动到卸货点 → 继续/结束
- Round 3 需送达 3 个卸货点才算 100%

**Step 8: 游戏结束**
- Round 4 结束后 → phase=`game_over`
- 显示最终 resource 分数
- 可点击"重新开始"

## Edge Cases

### EC1: 体力耗尽
- 场景：连续带重物（steel, weight=5）移动
- 预期：stamina=0 时 message 提示"体力耗尽"，后续每步 risk 仍增加
- 不要求自动结束，但每步状态压力加剧

### EC2: 格子断裂
- 场景：重复踩同一格子直到耐久=0
- 预期：格子变暗+✕标记，risk += 3，后续不可再踩

### EC3: 超时事故
- 场景：turn >= turnLimit
- 预期：phase=`accident`，risk += 5, resource -= 3

### EC4: 高风险事件链
- 场景：risk ≥ 10 触发 collapse_risk 事件，选择不当使 risk 继续上升
- 预期：risk ≥ 15 时再次触发事故判定

## Direction Gate
- integration worker 必须让上述 Round 1 全流程可试玩
- qa worker 必须用测试或手工记录验证上述每一步
- 如试玩要求需要偏离 Direction Lock，停止并回交 manager
