/**
 * 断梯运料 — 交互式游戏 UI
 *
 * 以脚手架格子为核心交互对象：
 *   - 格子可点击移动，颜色反映耐久
 *   - 五个 Required State 用仪表盘实时呈现
 *   - 材料选择以卡片形式操作
 *   - 事件以覆盖层呈现选择
 */

import { GameState } from '../game';
import { MATERIALS } from '../content/materials';

export type UIAction =
  | { type: 'select_materials'; materials: string[] }
  | { type: 'confirm_route' }
  | { type: 'move'; dx: number; dy: number }
  | { type: 'resolve_event'; choiceIndex: number }
  | { type: 'continue_after_delivery' }
  | { type: 'end_round' }
  | { type: 'next_round' }
  | { type: 'resolve_accident' }
  | { type: 'restart' };

export class GameUI {
  private root: HTMLElement;
  private onAction: (action: UIAction) => void;
  private pendingMaterials: string[] = [];
  private lastState: GameState | null = null;

  constructor(root: HTMLElement, onAction: (action: UIAction) => void) {
    this.root = root;
    this.onAction = onAction;
    this.root.addEventListener('click', (e) => this.handleClick(e));
  }

  // ── Event Delegation ──────────────────────────────────────

  private handleClick(e: Event): void {
    const t = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
    if (!t) return;
    const a = t.dataset.a;
    switch (a) {
      case 'mat': {
        const id = t.dataset.id!;
        const i = this.pendingMaterials.indexOf(id);
        i >= 0 ? this.pendingMaterials.splice(i, 1) : this.pendingMaterials.push(id);
        this.render(this.lastState!);
        return;
      }
      case 'confirmMat':
        if (!this.pendingMaterials.length) return;
        this.onAction({ type: 'select_materials', materials: [...this.pendingMaterials] });
        this.pendingMaterials = [];
        return;
      case 'confirmRoute':
        this.onAction({ type: 'confirm_route' });
        return;
      case 'step':
        this.onAction({ type: 'move', dx: +t.dataset.dx!, dy: +t.dataset.dy! });
        return;
      case 'eventChoice':
        this.onAction({ type: 'resolve_event', choiceIndex: +t.dataset.i! });
        return;
      case 'continue':
        this.onAction({ type: 'continue_after_delivery' });
        return;
      case 'endRound':
        this.onAction({ type: 'end_round' });
        return;
      case 'nextRound':
        this.onAction({ type: 'next_round' });
        return;
      case 'accident':
        this.onAction({ type: 'resolve_accident' });
        return;
      case 'restart':
        this.pendingMaterials = [];
        this.onAction({ type: 'restart' });
        return;
    }
  }

  // ── Main Render ───────────────────────────────────────────

  render(state: GameState): void {
    this.lastState = state;
    this.root.innerHTML = `
      <div style="max-width:760px;margin:0 auto;font-family:'Courier New',monospace;
        color:#ddd;background:#111;padding:16px;border-radius:8px;">
        ${this.header(state)}
        <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start;">
          ${this.gridPanel(state)}
          ${this.sidePanel(state)}
        </div>
        ${this.actionBar(state)}
        ${this.msgBar(state)}
      </div>`;
  }

  // ── Header ────────────────────────────────────────────────

  private header(s: GameState): string {
    const labels: Record<string, string> = {
      select_materials: '选择材料', plan_route: '规划路线', move: '移动中',
      event: '事件', arrived: '到达卸货点', accident: '事故',
      round_end: '轮次结算', game_over: '游戏结束',
    };
    return `<div style="margin-bottom:12px;">
      <div style="font-size:20px;font-weight:bold;color:#e8d44d;">
        断梯运料 — 第${s.round}轮${s.scaffold ? '：' + s.scaffold.name : ''}</div>
      <div style="font-size:12px;color:#888;margin-top:4px;">${s.scaffold?.description ?? ''}</div>
      <div style="margin-top:4px;font-size:13px;color:#aaa;">
        阶段: <span style="color:#e8d44d;">${labels[s.phase] ?? s.phase}</span></div>
    </div>`;
  }

  // ── Scaffold Grid ─────────────────────────────────────────

  private durColor(dur: number): string {
    if (dur <= 0) return '#1a1a1a';
    if (dur >= 5) return '#2a9d3a';
    if (dur >= 4) return '#4a8d2a';
    if (dur >= 3) return '#b8a020';
    if (dur >= 2) return '#d07020';
    return '#d03030';
  }

  private gridPanel(s: GameState): string {
    if (!s.scaffold) return '<div>无脚手架</div>';
    const t = s.scaffold;
    const cols = t.grid[0].length;
    const canClick = s.phase === 'move' || s.phase === 'plan_route';

    let cells = '';
    for (let y = 0; y < t.grid.length; y++) {
      for (let x = 0; x < cols; x++) {
        const dur = s.grid[y]?.[x] ?? 0;
        const orig = t.grid[y][x];
        const isP = s.pos[0] === x && s.pos[1] === y;
        const isE = t.endpoints.some(([ex, ey]) => ex === x && ey === y);
        const adj = canClick && this.isAdj(s, x, y) && dur > 0;
        const broken = orig > 0 && dur === 0;
        const bg = orig === 0 ? '#0d0d15' : this.durColor(dur);

        const bdr = isP ? '3px solid #fff' : isE ? '2px solid #e8d44d'
          : broken ? '1px dashed #600' : '1px solid #333';
        const shd = isP ? '0 0 12px rgba(255,255,255,.5)'
          : adj ? '0 0 8px rgba(255,255,255,.2)' : 'none';
        const click = adj
          ? `data-a="step" data-dx="${x - s.pos[0]}" data-dy="${y - s.pos[1]}"` : '';
        const lbl = isP ? '\u{1F477}' : isE ? '\u{1F4E6}' : broken ? '\u2715'
          : dur > 0 ? `${dur}` : '';

        cells += `<div style="width:52px;height:52px;background:${bg};border:${bdr};
          box-shadow:${shd};border-radius:4px;display:flex;align-items:center;
          justify-content:center;font-size:${isP ? 20 : 14}px;font-weight:bold;
          color:${isP ? '#fff' : isE ? '#e8d44d' : '#ddd'};
          cursor:${adj ? 'pointer' : 'default'};" ${click}>${lbl}</div>`;
      }
    }

    return `<div style="flex:1;min-width:${cols * 55}px;">
      <div style="display:grid;grid-template-columns:repeat(${cols},52px);gap:3px;">${cells}</div>
      <div style="font-size:11px;color:#666;margin-top:6px;">
        \u{1F477}=你 &nbsp; \u{1F4E6}=卸货点 &nbsp; 数字=耐久 &nbsp;
        <span style="color:#d03030;">\u2715</span>=断裂 &nbsp; 点击相邻格移动
      </div>
    </div>`;
  }

  private isAdj(s: GameState, x: number, y: number): boolean {
    return Math.abs(s.pos[0] - x) + Math.abs(s.pos[1] - y) === 1;
  }

  // ── Status Gauges ─────────────────────────────────────────

  private gauge(label: string, val: number, max: number, color: string): string {
    const pct = Math.round((Math.max(0, val) / max) * 100);
    return `<div style="margin:5px 0;">
      <div style="display:flex;justify-content:space-between;font-size:12px;">
        <span>${label}</span><span style="color:${color};">${val}</span></div>
      <div style="background:#222;height:8px;border-radius:4px;margin-top:2px;">
        <div style="background:${color};height:100%;width:${pct}%;border-radius:4px;
          transition:width .3s;"></div></div>
    </div>`;
  }

  private sidePanel(s: GameState): string {
    const rc = s.risk > 10 ? '#ff3030' : s.risk > 5 ? '#ff8800' : '#88aa44';
    const sc = s.scaffoldStability > 60 ? '#4a8d2a'
      : s.scaffoldStability > 30 ? '#b8a020' : '#d03030';
    const turn = s.turn;
    const lim = s.scaffold?.turnLimit ?? 0;

    return `<div style="flex:1;min-width:200px;">
      <div style="background:#0d0d15;padding:10px;border-radius:6px;border:1px solid #222;">
        <div style="font-size:13px;font-weight:bold;color:#e8d44d;margin-bottom:6px;">核心状态</div>
        ${this.gauge('体力', s.stamina, 20, '#4488ff')}
        ${this.gauge('架体稳定', s.scaffoldStability, 100, sc)}
        ${this.gauge('坠落风险', s.risk, 20, rc)}
        ${this.gauge('卸货进度', s.deliveryProgress, 100, '#e8d44d')}
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px;">
          <span>负重: <b style="color:#ff8844;">${s.loadWeight}</b></span>
          <span>回合: <b style="color:${turn > lim * 0.8 ? '#ff3030' : '#aaa'};">${turn}/${lim}</b></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-top:4px;">
          <span>资源: ${s.resource}</span><span>关系: ${s.relation}</span>
        </div>
      </div>
    </div>`;
  }

  // ── Phase-Specific Action Bar ─────────────────────────────

  private actionBar(s: GameState): string {
    const wrap = (inner: string) =>
      `<div style="margin-top:12px;background:#0d0d15;padding:12px;border-radius:6px;
        border:1px solid #222;">${inner}</div>`;

    if (s.phase === 'select_materials') return wrap(this.materialCards(s));
    if (s.phase === 'plan_route') return wrap(`
      <div style="font-size:13px;margin-bottom:8px;">查看脚手架布局，观察格子耐久和卸货点位置，然后确认出发。</div>
      <button data-a="confirmRoute" style="padding:8px 24px;background:#e8d44d;color:#111;
        border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:14px;">
        确认路线，出发</button>`);
    if (s.phase === 'move') return wrap(`
      <div style="font-size:13px;color:#888;text-align:center;">
        点击脚手架上相邻的格子移动。每步消耗体力和格子耐久。负重越大，消耗越猛。</div>`);
    if (s.phase === 'event' && s.pendingEvent) return wrap(this.eventPanel(s));
    if (s.phase === 'arrived') return wrap(`
      <div style="text-align:center;">
        <div style="font-size:16px;color:#4a8d2a;font-weight:bold;margin-bottom:8px;">
          \u2713 到达卸货点！卸货进度 ${s.deliveryProgress}%</div>
        <button data-a="continue" style="padding:8px 24px;background:#4a8d2a;color:#fff;
          border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:14px;">
          继续搬运</button>
      </div>`);
    if (s.phase === 'accident') return wrap(`
      <div style="text-align:center;">
        <div style="font-size:16px;color:#ff3030;font-weight:bold;margin-bottom:8px;">
          \u26A0 事故！脚手架出问题了。</div>
        <button data-a="accident" style="padding:8px 24px;background:#ff3030;color:#fff;
          border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:14px;">
          处理事故</button>
      </div>`);
    if (s.phase === 'round_end') return wrap(`
      <div style="text-align:center;">
        <div style="font-size:16px;color:#e8d44d;font-weight:bold;margin-bottom:8px;">
          第${s.round}轮结束 — 资源:${s.resource} 关系:${s.relation}</div>
        ${s.round >= 4 ? '<div style="color:#888;">所有轮次已完成。</div>'
          : `<button data-a="nextRound" style="padding:8px 24px;background:#e8d44d;color:#111;
              border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:14px;">
              进入第${s.round + 1}轮</button>`}
      </div>`);
    if (s.phase === 'game_over') return wrap(`
      <div style="text-align:center;">
        <div style="font-size:20px;color:#e8d44d;font-weight:bold;margin-bottom:8px;">游戏结束</div>
        <div style="font-size:14px;margin-bottom:12px;">最终资源: ${s.resource}</div>
        <button data-a="restart" style="padding:8px 24px;background:#e8d44d;color:#111;
          border:none;border-radius:4px;font-weight:bold;cursor:pointer;font-size:14px;">
          重新开始</button>
      </div>`);
    return '';
  }

  // ── Material Selection Cards ──────────────────────────────

  private materialCards(s: GameState): string {
    const w = this.pendingMaterials.reduce((sum, id) => {
      const m = MATERIALS.find(mat => mat.id === id);
      return sum + (m?.weight ?? 0);
    }, 0);

    let html = `<div style="font-size:13px;margin-bottom:8px;">
      选择材料组合 — 当前负重: <b style="color:#ff8844;">${w}</b></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">`;

    for (const m of MATERIALS) {
      const sel = this.pendingMaterials.includes(m.id);
      const sc = m.stability > 0 ? '#4a8d2a' : m.stability < 0 ? '#d03030' : '#888';
      html += `<div data-a="mat" data-id="${m.id}" style="padding:8px;width:105px;
        background:${sel ? '#2a2a1e' : '#0d0d15'};
        border:1px solid ${sel ? '#e8d44d' : '#333'};border-radius:4px;cursor:pointer;
        ${sel ? 'box-shadow:0 0 6px rgba(232,212,77,.3);' : ''}">
        <div style="font-weight:bold;font-size:13px;">${m.name}</div>
        <div style="font-size:11px;color:#888;margin-top:2px;">
          重:${m.weight} 值:${m.value}</div>
        <div style="font-size:11px;color:${sc};">
          稳定:${m.stability > 0 ? '+' : ''}${m.stability}</div>
      </div>`;
    }

    html += `</div>
      <button data-a="confirmMat" style="margin-top:8px;padding:8px 24px;
        background:#e8d44d;color:#111;border:none;border-radius:4px;font-weight:bold;
        cursor:pointer;font-size:14px;
        ${!this.pendingMaterials.length ? 'opacity:.4;pointer-events:none;' : ''}">
        确认选材 (${this.pendingMaterials.length}件)</button>`;
    return html;
  }

  // ── Event Overlay ─────────────────────────────────────────

  private eventPanel(s: GameState): string {
    const ev = s.pendingEvent!;
    let html = `<div style="margin-bottom:6px;">
      <div style="font-size:15px;font-weight:bold;color:#ff8844;margin-bottom:6px;">
        \u26A0 ${ev.name}</div>
      <div style="font-size:13px;margin-bottom:10px;">${ev.description}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">`;

    ev.choices.forEach((c, i) => {
      html += `<button data-a="eventChoice" data-i="${i}" style="flex:1;min-width:200px;
        padding:10px;background:#1a1a3e;border:1px solid #444;border-radius:4px;
        color:#ddd;cursor:pointer;font-size:13px;text-align:left;">
        <div style="font-weight:bold;margin-bottom:4px;">${c.text}</div>
        <div style="font-size:11px;color:#888;">${this.deltaStr(c.effects)}</div>
      </button>`;
    });

    return html + '</div></div>';
  }

  private deltaStr(e: Record<string, number>): string {
    const p: string[] = [];
    if (e.resource) p.push(`资源${e.resource > 0 ? '+' : ''}${e.resource}`);
    if (e.pressure) p.push(`压力${e.pressure > 0 ? '+' : ''}${e.pressure}`);
    if (e.risk) p.push(`风险${e.risk > 0 ? '+' : ''}${e.risk}`);
    if (e.relation) p.push(`关系${e.relation > 0 ? '+' : ''}${e.relation}`);
    return p.join(' ');
  }

  // ── Message Bar ───────────────────────────────────────────

  private msgBar(s: GameState): string {
    if (!s.message) return '';
    return `<div style="margin-top:8px;padding:8px;background:#0a0a12;border-radius:4px;
      font-size:12px;color:#aaa;border-left:3px solid #e8d44d;">
      ${s.message.replace(/\n/g, '<br>')}</div>`;
  }
}
