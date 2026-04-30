# SCENE_INTERACTION_SPEC: 断梯运料

## Scene Objects

- 脚手架格子
- 材料堆
- 卸货点
- 破损格
- 加固点

## Player Input

- primary_input: 在脚手架格子上规划路线并选择携带负重
- minimum_interaction: 玩家必须选择材料负重并逐格移动，踩踏会改变脚手架稳定和坠落风险

## Feedback Channels

- 格子耐久颜色
- 角色体力条
- 坠落风险提示
- delivery_progress

## Forbidden UI

- 不允许只用“走近路/走远路”选择
- 不允许做开放地图探索

## Acceptance Rule

- 首屏必须让玩家看到至少一个可直接操作的场景对象
- 玩家操作必须产生即时可见反馈，且反馈能追溯到 Required State
- 不得只靠随机事件文本或普通选择按钮完成主循环
