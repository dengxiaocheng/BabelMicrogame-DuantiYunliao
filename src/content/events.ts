/**
 * 断梯运料 — 事件池
 *
 * 每条事件都在核心循环的某一步触发，直接操作五个状态：
 *   resource  — 材料 / 工具
 *   pressure  — 时间 / 工期压力
 *   risk      — 坠落 / 塌架风险
 *   relation  — 工友 / 工头关系
 *   round     — 轮次推进（仅少数事件）
 *
 * 设计原则：
 * 1. 事件只服务「负重 + 格子路径 + 承压稳定」这一情绪。
 * 2. 每条事件给出 2 个选项，让玩家在贪心和谨慎之间做取舍。
 * 3. 不写与搬运无关的剧情。
 */

export type EventTrigger =
  | 'move'          // 移动到新格子
  | 'load'          // 选择材料组合后
  | 'rest'          // 在安全格休息
  | 'arrive'        // 到达卸货点
  | 'collapse_risk';// risk 超过阈值时

export interface StateDelta {
  resource?: number;
  pressure?: number;
  risk?: number;
  relation?: number;
  round?: number;
}

export interface EventChoice {
  text: string;
  effects: StateDelta;
  outcome: string;
}

export interface GameEvent {
  id: string;
  name: string;
  trigger: EventTrigger;
  description: string;
  choices: EventChoice[];
}

export const EVENTS: GameEvent[] = [
  // ── move 触发 ──────────────────────────────────────
  {
    id: 'ev_creak',
    name: '脚下木板发出脆响',
    trigger: 'move',
    description: '你踩上的这块板明显老化了，脚下传来细微的断裂声。负重的惯性让你身体前倾。',
    choices: [
      {
        text: '立刻停下，用脚试探确认',
        effects: { pressure: 1 },
        outcome: '你花了几秒确认板子还能撑住，但工头的催促声更近了。',
      },
      {
        text: '不管了，快速通过',
        effects: { risk: 2 },
        outcome: '你加速冲过，身后传来木板彻底断裂的声音。下次运气不会这么好。',
      },
    ],
  },
  {
    id: 'ev_wind',
    name: '一阵横风',
    trigger: 'move',
    description: '高处突然刮来一阵横风，背上的货物把你往外侧拽。',
    choices: [
      {
        text: '蹲低重心，等风过去',
        effects: { pressure: 1, risk: -1 },
        outcome: '你紧贴脚手架蹲下，风过后稳稳起身。浪费了几秒，但安全。',
      },
      {
        text: '顶着风继续走',
        effects: { risk: 2, relation: 1 },
        outcome: '你咬牙走了过去。旁边的工友看在眼里，竖了竖大拇指。',
      },
    ],
  },
  {
    id: 'ev_gap',
    name: '前方断板',
    trigger: 'move',
    description: '前方的格子缺失了一块板，需要跨过去。你身上货物的重量让这个动作变得危险。',
    choices: [
      {
        text: '放下货物，空手跳过去再回来搬',
        effects: { pressure: 2, risk: -1 },
        outcome: '稳妥但费时。你跳过去了，回头再把货一趟趟搬。',
      },
      {
        text: '抱着货物直接跳',
        effects: { risk: 3 },
        outcome: '你起跳时脚下打滑——勉强落到了对面，但背上一袋水泥差点翻下去。',
      },
    ],
  },
  {
    id: 'ev_meet_worker',
    name: '遇到换班的工友',
    trigger: 'move',
    description: '狭窄的通道上迎面走来一个工友，双方都需要通过。',
    choices: [
      {
        text: '侧身让路，互相协助稳住重心',
        effects: { relation: 1, pressure: 1 },
        outcome: '你们小心地侧身而过，他帮你扶了一把背上的货。耽误了点时间。',
      },
      {
        text: '先走为快，不等人',
        effects: { relation: -1, pressure: -1 },
        outcome: '你抢先通过，对方低声骂了一句。快了几秒，但以后别指望他帮忙。',
      },
    ],
  },

  // ── load 触发 ──────────────────────────────────────
  {
    id: 'ev_bundle_loose',
    name: '捆扎松动',
    trigger: 'load',
    description: '刚出发几步，你感觉到背上的捆扎在滑动。再走下去货物可能散落。',
    choices: [
      {
        text: '停下来重新绑紧',
        effects: { pressure: 1, resource: 1 },
        outcome: '你花了时间重新固定，还发现可以多塞一件小货。',
      },
      {
        text: '用手压住，坚持到卸货点',
        effects: { risk: 2 },
        outcome: '你一路用手按着摇摇欲坠的货物，每一步都提心吊胆。',
      },
    ],
  },
  {
    id: 'ev_shift',
    name: '重心偏移',
    trigger: 'load',
    description: '货物重心突然偏向一侧，你的身体跟着歪了过来。脚手架在脚下吱嘎作响。',
    choices: [
      {
        text: '卸掉最重的那件，重新分配',
        effects: { resource: -1, risk: -2 },
        outcome: '你放下钢筋，轻装上阵。少赚一笔，但至少能活着走完。',
      },
      {
        text: '调整姿势，硬撑着走',
        effects: { risk: 2, pressure: -1 },
        outcome: '你咬着牙用不正常的姿势继续走。速度快了，但每一步都在赌命。',
      },
    ],
  },

  // ── arrive 触发 ──────────────────────────────────────
  {
    id: 'ev_understaffed',
    name: '卸货点人手不足',
    trigger: 'arrive',
    description: '你终于到了卸货点，但接货的人不够。你的货物堆在地上，等着被清点。',
    choices: [
      {
        text: '自己动手卸货',
        effects: { pressure: 1, resource: 1, relation: 1 },
        outcome: '你帮着一起卸，速度快了不少。验收员对你的态度好了几分。',
      },
      {
        text: '放下就走，回去再拉一趟',
        effects: { pressure: -1, resource: -1 },
        outcome: '你把货一放就往回赶。效率是高了，但有些货在混乱中没被正确清点。',
      },
    ],
  },
  {
    id: 'ev_inspector',
    name: '验收员挑刺',
    trigger: 'arrive',
    description: '验收员对着你的货翻来覆去地看，皱着眉头说有几件不合格。',
    choices: [
      {
        text: '据理力争',
        effects: { relation: -1, resource: 1, pressure: 1 },
        outcome: '你吵了一架，最后他勉强认了大部分货。但结下了梁子。',
      },
      {
        text: '认了，赶紧回去再补',
        effects: { resource: -1, relation: 1 },
        outcome: '你咽下这口气。他看你识趣，下次或许能通融几分。',
      },
    ],
  },

  // ── collapse_risk 触发 ──────────────────────────────
  {
    id: 'ev_shake',
    name: '脚手架剧烈晃动',
    trigger: 'collapse_risk',
    description: '整面脚手架突然剧烈摇晃！你能感觉到脚下的结构正在超出承载极限。',
    choices: [
      {
        text: '抛下货物，抓住栏杆求生',
        effects: { resource: -2, risk: -3, pressure: 1 },
        outcome: '你丢掉了大部分货，但至少人还在。脚手架在几秒后稳定下来。',
      },
      {
        text: '死死抱住货物，蹲低',
        effects: { risk: 3, resource: 1 },
        outcome: '你把货物压在身下，赌它不会塌。摇晃停了——但只是这一次。',
      },
    ],
  },
  {
    id: 'ev_joint',
    name: '关键节点松动',
    trigger: 'collapse_risk',
    description: '你注意到脚手架的一个连接件在松动，那是承重结构的关键节点。',
    choices: [
      {
        text: '花时间加固节点',
        effects: { pressure: 2, risk: -3, relation: 1 },
        outcome: '你用工具箱把节点重新拧紧。花了宝贵的时间，但救了整面架。路过的工友心存感激。',
      },
      {
        text: '标记一下，继续赶路',
        effects: { risk: 1, pressure: -1 },
        outcome: '你用粉笔在节点上画了个叉，希望下一趟还有时间处理。',
      },
    ],
  },

  // ── rest 触发 ──────────────────────────────────────
  {
    id: 'ev_rest',
    name: '短暂的喘息',
    trigger: 'rest',
    description: '你在安全平台上歇脚，体力稍有恢复。远处能看到今天的进度和剩余时间。',
    choices: [
      {
        text: '检查装备和脚手架状况',
        effects: { risk: -1, pressure: 1 },
        outcome: '你仔细检查了路线上的薄弱点，心里有数了。但时间在流逝。',
      },
      {
        text: '和旁边的工友聊两句',
        effects: { relation: 1, pressure: -1 },
        outcome: '他告诉你前方有一段路比看起来更危险。你暗暗记下。',
      },
    ],
  },
  {
    id: 'ev_foreman',
    name: '工头催促',
    trigger: 'rest',
    description: '工头在对讲机里喊："磨蹭什么？太阳下山前这批货必须到！"',
    choices: [
      {
        text: '回一句"马上"，调整呼吸出发',
        effects: { pressure: 1, risk: 1 },
        outcome: '你加快了节奏，但心里清楚急躁是出事的根源。',
      },
      {
        text: '不理他，按自己的节奏来',
        effects: { relation: -1, risk: -1 },
        outcome: '你无视了催促。工头不会高兴，但至少你不会因为慌乱出错。',
      },
    ],
  },
];

/** 按 trigger 类型索引，O(1) 查询 */
export const EVENTS_BY_TRIGGER = Object.groupBy(
  EVENTS,
  (e) => e.trigger,
) as Record<EventTrigger, GameEvent[]>;

/** 随机抽取一条指定 trigger 的事件 */
export function randomEvent(trigger: EventTrigger): GameEvent | undefined {
  const pool = EVENTS_BY_TRIGGER[trigger];
  if (!pool || pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}
