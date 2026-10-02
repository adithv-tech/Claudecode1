import { cardDef, cardStats, needsTarget } from './cards';
import { ENEMIES } from './data/enemies';
import { RELICS } from './data/relics';
import { Rng } from './rng';
import { STATUSES, STATUS_ORDER } from './status';
import type {
  CardInstance,
  CombatAction,
  CombatApi,
  CombatEventBody,
  CombatState,
  Effect,
  EnemyUnit,
  RelicDef,
  StatusId,
  Unit,
  UnitId,
} from './types';

export const HAND_SIZE = 5;
export const MAX_HAND = 10;
const EVENT_HISTORY = 80;

// ---------------------------------------------------------------------------
// The combat API: every rule mutation goes through here so it emits events
// and triggers status / relic hooks consistently.
// ---------------------------------------------------------------------------

function relicDefs(s: CombatState): RelicDef[] {
  return s.relics.map((id) => RELICS[id]).filter(Boolean);
}

function isAlive(u: Unit | undefined): u is Unit {
  return !!u && u.hp > 0;
}

export function createApi(state: CombatState): CombatApi {
  const rng = new Rng(state.rngState);

  const api: CombatApi = {
    state,
    rng,

    emit(event: CombatEventBody) {
      state.eventSeq += 1;
      state.events.push({ ...event, id: state.eventSeq });
    },

    unit(id) {
      return id === 'player' ? state.player : state.enemies.find((e) => e.id === id);
    },

    opponents(id) {
      if (id === 'player') return state.enemies.filter(isAlive).map((e) => e.id);
      return isAlive(state.player) ? ['player'] : [];
    },

    dealDamage(source, target, amount) {
      const t = api.unit(target);
      if (!isAlive(t) || isOver(state)) return;
      let remaining = Math.max(0, Math.floor(amount));
      const blocked = Math.min(t.block, remaining);
      t.block -= blocked;
      remaining -= blocked;
      const shield = t.statuses.shield ?? 0;
      const shielded = Math.min(shield, remaining);
      if (shielded > 0) api.setStatus(target, 'shield', shield - shielded);
      remaining -= shielded;
      t.hp = Math.max(0, t.hp - remaining);
      api.emit({ type: 'damage', target, amount: remaining, blocked, shielded });
      if (t.hp === 0) {
        handleDeath(api, target);
        return;
      }
      const thorns = t.statuses.thorns ?? 0;
      if (source && thorns > 0 && source !== target) api.dealDamage(null, source, thorns);
    },

    loseHp(target, amount) {
      const t = api.unit(target);
      if (!isAlive(t) || amount <= 0 || isOver(state)) return;
      t.hp = Math.max(0, t.hp - amount);
      api.emit({ type: 'damage', target, amount, blocked: 0, shielded: 0, pierce: true });
      if (t.hp === 0) handleDeath(api, target);
    },

    gainBlock(target, amount) {
      const t = api.unit(target);
      if (!isAlive(t) || amount <= 0) return;
      t.block += amount;
      api.emit({ type: 'block', target, amount });
    },

    applyStatus(source, target, status, amount) {
      const t = api.unit(target);
      if (!isAlive(t)) return;
      let final = amount;
      for (const r of relicDefs(state)) if (r.modifyStatusApply) final = r.modifyStatusApply(source, target, status, final);
      if (final === 0) return;
      api.setStatus(target, status, (t.statuses[status] ?? 0) + final);
      api.emit({ type: 'status', target, status, amount: final });
      for (const r of relicDefs(state)) r.onStatusGained?.(api, target, status, final);
    },

    setStatus(target, status, value) {
      const t = api.unit(target);
      if (!t) return;
      if (value > 0) t.statuses[status] = value;
      else delete t.statuses[status];
    },

    heal(target, amount) {
      const t = api.unit(target);
      if (!isAlive(t)) return;
      const healed = Math.min(amount, t.maxHp - t.hp);
      if (healed <= 0) return;
      t.hp += healed;
      api.emit({ type: 'heal', target, amount: healed });
    },

    draw(count) {
      const drawn: string[] = [];
      for (let i = 0; i < count; i++) {
        if (state.hand.length >= MAX_HAND) break;
        if (state.drawPile.length === 0) {
          if (state.discardPile.length === 0) break;
          state.drawPile = rng.shuffle(state.discardPile);
          state.discardPile = [];
          api.emit({ type: 'shuffle' });
        }
        const card = state.drawPile.pop()!;
        state.hand.push(card);
        drawn.push(card.uid);
      }
      if (drawn.length) api.emit({ type: 'draw', uids: drawn });
    },

    gainEnergy(amount) {
      if (amount === 0) return;
      state.player.energy += amount;
      api.emit({ type: 'energy', amount });
    },
  };
  return api;
}

function isOver(s: CombatState): boolean {
  return s.phase === 'won' || s.phase === 'lost';
}

function handleDeath(api: CombatApi, id: UnitId) {
  const s = api.state;
  const u = api.unit(id)!;
  u.block = 0;
  u.statuses = {};
  api.emit({ type: 'death', target: id });
  if (id === 'player') {
    s.phase = 'lost';
    api.emit({ type: 'defeat' });
    return;
  }
  for (const r of relicDefs(s)) r.onEnemyDeath?.(api, id);
  if (s.enemies.every((e) => e.hp <= 0)) {
    s.phase = 'won';
    api.emit({ type: 'victory' });
  }
}

// ---------------------------------------------------------------------------
// Damage math
// ---------------------------------------------------------------------------

/** Attack damage after the attacker's and defender's status modifiers. */
export function attackDamage(source: Unit, target: Unit | null, base: number): number {
  let d = base;
  for (const id of STATUS_ORDER) {
    const n = source.statuses[id];
    const mod = STATUSES[id].modifyOutgoing;
    if (n && mod) d = mod(d, n);
  }
  if (target) {
    for (const id of STATUS_ORDER) {
      const n = target.statuses[id];
      const mod = STATUSES[id].modifyIncoming;
      if (n && mod) d = mod(d, n);
    }
  }
  return Math.max(0, Math.floor(d));
}

function attack(api: CombatApi, source: UnitId, target: UnitId, base: number) {
  const src = api.unit(source);
  const tgt = api.unit(target);
  if (!isAlive(src) || !isAlive(tgt)) return;
  api.dealDamage(source, target, attackDamage(src, tgt, base));
}

// ---------------------------------------------------------------------------
// Effect resolution (shared by cards and enemy intents)
// ---------------------------------------------------------------------------

function resolveTargets(api: CombatApi, source: UnitId, target: UnitId | undefined, to: 'target' | 'self' | 'all'): UnitId[] {
  if (to === 'self') return [source];
  if (to === 'all') return api.opponents(source);
  return target ? [target] : [];
}

export function resolveEffect(api: CombatApi, effect: Effect, source: UnitId, target?: UnitId) {
  if (isOver(api.state)) return;
  switch (effect.kind) {
    case 'damage': {
      const times = effect.times ?? 1;
      for (let i = 0; i < times; i++) {
        for (const t of resolveTargets(api, source, target, effect.to ?? 'target')) attack(api, source, t, effect.amount);
      }
      break;
    }
    case 'block':
      api.gainBlock(source, effect.amount);
      break;
    case 'apply':
      for (const t of resolveTargets(api, source, target, effect.to)) api.applyStatus(source, t, effect.status, effect.amount);
      break;
    case 'draw':
      if (source === 'player') api.draw(effect.amount);
      break;
    case 'energy':
      if (source === 'player') api.gainEnergy(effect.amount);
      break;
    case 'heal':
      api.heal(source, effect.amount);
      break;
    case 'damageFromBlock':
      if (target) attack(api, source, target, api.unit(source)?.block ?? 0);
      break;
    case 'detonate': {
      const t = target ? api.unit(target) : undefined;
      if (t) attack(api, source, target!, (t.statuses.poison ?? 0) * effect.mult);
      break;
    }
    case 'multiplyStatus': {
      const t = target ? api.unit(target) : undefined;
      const cur = t?.statuses[effect.status] ?? 0;
      if (t && cur > 0) api.applyStatus(source, target!, effect.status, cur * (effect.mult - 1));
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Turn pipeline
// ---------------------------------------------------------------------------

function runStatusHooks(api: CombatApi, owner: UnitId, hook: 'onTurnStart' | 'onTurnEnd') {
  for (const id of STATUS_ORDER) {
    const u = api.unit(owner);
    if (!isAlive(u) || isOver(api.state)) return;
    const stacks = u.statuses[id];
    const fn = STATUSES[id][hook];
    if (stacks && fn) fn(api, owner, stacks);
  }
}

function consumeStatus(api: CombatApi, owner: UnitId, status: StatusId): boolean {
  const u = api.unit(owner);
  const n = u?.statuses[status] ?? 0;
  if (n <= 0) return false;
  api.setStatus(owner, status, n - 1);
  return true;
}

function startPlayerTurn(api: CombatApi) {
  const s = api.state;
  s.turn += 1;
  s.phase = 'player';
  s.cardsPlayedThisTurn = 0;
  s.player.block = 0;
  s.player.energy = s.player.maxEnergy;
  api.emit({ type: 'turn', who: 'player', turn: s.turn });
  // Turn 1 has only just-applied combat-start statuses; don't tick them yet.
  if (s.turn > 1) runStatusHooks(api, 'player', 'onTurnStart');
  if (isOver(s)) return;
  for (const r of relicDefs(s)) r.onTurnStart?.(api);
  let draw = HAND_SIZE;
  if (consumeStatus(api, 'player', 'stun')) {
    draw -= 2;
    api.emit({ type: 'stunned', target: 'player' });
  }
  api.draw(draw);
}

function rollIntent(api: CombatApi, enemy: EnemyUnit) {
  const def = ENEMIES[enemy.defId];
  let move: string;
  if (def.random) {
    const options = def.script.filter((m) => m !== enemy.lastMove);
    move = api.rng.pick(options.length ? options : def.script);
  } else {
    move = def.script[enemy.moveIndex % def.script.length];
    enemy.moveIndex += 1;
  }
  enemy.intent = move;
}

function endPlayerTurn(api: CombatApi) {
  const s = api.state;
  runStatusHooks(api, 'player', 'onTurnEnd');
  if (isOver(s)) return;
  s.discardPile.push(...s.hand);
  s.hand = [];
  s.phase = 'enemy';
  s.enemyCursor = 0;
  api.emit({ type: 'turn', who: 'enemy', turn: s.turn });
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.block = 0;
    runStatusHooks(api, e.id, 'onTurnStart');
    if (isOver(s)) return;
  }
}

/** Resolves the next living enemy's intent; when none remain, begins the player's turn. */
function enemyStep(api: CombatApi) {
  const s = api.state;
  const idx = s.enemies.findIndex((e, i) => i >= s.enemyCursor && e.hp > 0);
  if (idx === -1) {
    startPlayerTurn(api);
    return;
  }
  const enemy = s.enemies[idx];
  s.enemyCursor = idx + 1;
  const move = enemy.intent!;
  if (consumeStatus(api, enemy.id, 'stun')) {
    api.emit({ type: 'stunned', target: enemy.id });
  } else {
    api.emit({ type: 'enemyAct', enemy: enemy.id, move });
    for (const effect of ENEMIES[enemy.defId].moves[move].effects) resolveEffect(api, effect, enemy.id, 'player');
  }
  enemy.lastMove = move;
  if (isOver(s) || enemy.hp <= 0) return;
  runStatusHooks(api, enemy.id, 'onTurnEnd');
  if (enemy.hp > 0) rollIntent(api, enemy);
}

// ---------------------------------------------------------------------------
// Card play
// ---------------------------------------------------------------------------

export function effectiveCost(s: CombatState, card: CardInstance): number {
  let cost = cardStats(card).cost;
  const api = createApi(s); // read-only use: modifyCost hooks never mutate
  for (const r of relicDefs(s)) if (r.modifyCost) cost = r.modifyCost(api, card, cost);
  return Math.max(0, cost);
}

export type PlayCheck = { ok: true } | { ok: false; reason: 'phase' | 'missing' | 'energy' | 'target' };

export function canPlay(s: CombatState, uid: string, target?: UnitId): PlayCheck {
  if (s.phase !== 'player') return { ok: false, reason: 'phase' };
  const card = s.hand.find((c) => c.uid === uid);
  if (!card) return { ok: false, reason: 'missing' };
  if (effectiveCost(s, card) > s.player.energy) return { ok: false, reason: 'energy' };
  if (needsTarget(cardStats(card).effects)) {
    const t = s.enemies.find((e) => e.id === target);
    if (!t || t.hp <= 0) return { ok: false, reason: 'target' };
  }
  return { ok: true };
}

function playCard(api: CombatApi, uid: string, target?: UnitId) {
  const s = api.state;
  const card = s.hand.find((c) => c.uid === uid)!;
  const stats = cardStats(card);
  s.player.energy -= effectiveCost(s, card);
  s.hand = s.hand.filter((c) => c.uid !== uid);
  const targeted = needsTarget(stats.effects);
  api.emit({ type: 'cardPlayed', uid, defId: card.defId, target: targeted ? target : undefined });
  for (const effect of stats.effects) resolveEffect(api, effect, 'player', targeted ? target : undefined);
  // Powers leave the deck for the rest of combat; exhausted cards are removed too.
  if (cardDef(card).type === 'power' || stats.exhaust) s.exhaustPile.push(card);
  else s.discardPile.push(card);
  s.cardsPlayedThisTurn += 1;
  s.cardsPlayedThisCombat += 1;
  if (!isOver(s)) for (const r of relicDefs(s)) r.onCardPlayed?.(api, card);
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export interface CombatSetup {
  deck: CardInstance[];
  hp: number;
  maxHp: number;
  maxEnergy?: number;
  relics: string[];
  enemies: string[];
  seed: number;
}

export function startCombat(setup: CombatSetup): CombatState {
  const rng = new Rng(setup.seed);
  const enemies: EnemyUnit[] = setup.enemies.map((defId, i) => {
    const def = ENEMIES[defId];
    const hp = rng.int(def.hp[0], def.hp[1]);
    return {
      id: `${defId}-${i}`,
      defId,
      name: def.name,
      glyph: def.glyph,
      hp,
      maxHp: hp,
      block: 0,
      statuses: {},
      moveIndex: 0,
      intent: null,
      lastMove: null,
    };
  });
  const state: CombatState = {
    player: {
      id: 'player',
      name: 'You',
      hp: setup.hp,
      maxHp: setup.maxHp,
      block: 0,
      statuses: {},
      energy: 0,
      maxEnergy: setup.maxEnergy ?? 3,
    },
    enemies,
    drawPile: rng.shuffle(setup.deck.map((c) => ({ ...c }))),
    hand: [],
    discardPile: [],
    exhaustPile: [],
    relics: [...setup.relics],
    turn: 0,
    phase: 'player',
    enemyCursor: 0,
    cardsPlayedThisTurn: 0,
    cardsPlayedThisCombat: 0,
    rngState: rng.state,
    events: [],
    eventSeq: 0,
  };
  const api = createApi(state);
  for (const e of state.enemies) rollIntent(api, e);
  for (const r of relicDefs(state)) {
    if (r.onCombatStart) {
      api.emit({ type: 'relic', relicId: r.id });
      r.onCombatStart(api);
    }
  }
  startPlayerTurn(api);
  state.rngState = api.rng.state;
  return state;
}

/** Pure reducer: returns a new state, never mutates the input. Invalid actions return the input unchanged. */
export function combatReducer(prev: CombatState, action: CombatAction): CombatState {
  if (isOver(prev)) return prev;
  if (action.type === 'playCard' && !canPlay(prev, action.uid, action.target).ok) return prev;
  if (action.type === 'endTurn' && prev.phase !== 'player') return prev;
  if (action.type === 'enemyStep' && prev.phase !== 'enemy') return prev;

  const s = structuredClone(prev);
  const api = createApi(s);
  switch (action.type) {
    case 'playCard':
      playCard(api, action.uid, action.target);
      break;
    case 'endTurn':
      endPlayerTurn(api);
      break;
    case 'enemyStep':
      enemyStep(api);
      break;
  }
  s.rngState = api.rng.state;
  if (s.events.length > EVENT_HISTORY) s.events = s.events.slice(-EVENT_HISTORY);
  return s;
}

/** Runs every enemy action and starts the next player turn (used by tests / fast-forward). */
export function resolveEnemyTurn(s: CombatState): CombatState {
  let cur = s;
  while (cur.phase === 'enemy') cur = combatReducer(cur, { type: 'enemyStep' });
  return cur;
}

export interface IntentPreview {
  name: string;
  /** Raw per-hit damage after modifiers (before the player's Block). */
  damage: number | null;
  hits: number;
  kinds: ('attack' | 'defend' | 'buff' | 'debuff')[];
}

/** Simulates an enemy's intent on a scratch copy to show accurate numbers (incl. self-buffs like Overdrive). */
export function previewIntent(s: CombatState, enemyId: UnitId): IntentPreview | null {
  const enemy = s.enemies.find((e) => e.id === enemyId);
  if (!enemy || enemy.hp <= 0 || !enemy.intent) return null;
  const intent = ENEMIES[enemy.defId].moves[enemy.intent];
  const scratch = structuredClone(s);
  scratch.events = [];
  scratch.phase = 'enemy';
  scratch.player.block = 0;
  delete scratch.player.statuses.shield;
  delete scratch.player.statuses.thorns;
  scratch.player.hp = 9999;
  scratch.player.maxHp = 9999;
  scratch.relics = [];
  const api = createApi(scratch);
  for (const effect of intent.effects) resolveEffect(api, effect, enemyId, 'player');
  const hits = scratch.events.filter((e) => e.type === 'damage' && e.target === 'player' && !e.pierce);
  const kinds = new Set<IntentPreview['kinds'][number]>();
  for (const e of intent.effects) {
    if (e.kind === 'damage') kinds.add('attack');
    else if (e.kind === 'block' || (e.kind === 'apply' && e.status === 'shield')) kinds.add('defend');
    else if (e.kind === 'apply' && e.to === 'self') kinds.add('buff');
    else if (e.kind === 'apply') kinds.add('debuff');
  }
  return {
    name: intent.name,
    damage: hits.length && hits[0].type === 'damage' ? hits[0].amount : null,
    hits: hits.length,
    kinds: [...kinds],
  };
}
