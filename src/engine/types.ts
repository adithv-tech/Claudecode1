import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------

export type StatusId =
  | 'strength'
  | 'overdrive'
  | 'weak'
  | 'vulnerable'
  | 'shield'
  | 'poison'
  | 'stun'
  | 'thorns'
  | 'reactor'
  | 'nanites'
  | 'aegis';

export type Statuses = Partial<Record<StatusId, number>>;

export interface StatusDef {
  id: StatusId;
  name: string;
  icon: string;
  kind: 'buff' | 'debuff';
  describe: (stacks: number) => string;
  /** Runs at the start of the owner's turn, in STATUS_ORDER. */
  onTurnStart?: (api: CombatApi, owner: UnitId, stacks: number) => void;
  /** Runs at the end of the owner's turn, in STATUS_ORDER. */
  onTurnEnd?: (api: CombatApi, owner: UnitId, stacks: number) => void;
  /** Adjusts damage this unit deals with attacks. */
  modifyOutgoing?: (damage: number, stacks: number) => number;
  /** Adjusts attack damage this unit receives. */
  modifyIncoming?: (damage: number, stacks: number) => number;
}

// ---------------------------------------------------------------------------
// Effects (shared by cards and enemy intents)
// ---------------------------------------------------------------------------

/** "target" = the chosen enemy (or the player, for enemy intents); "all" = every living opponent. */
export type EffectTarget = 'target' | 'self' | 'all';

export type Effect =
  | { kind: 'damage'; amount: number; times?: number; to?: 'target' | 'all' }
  | { kind: 'block'; amount: number }
  | { kind: 'apply'; status: StatusId; amount: number; to: EffectTarget }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'damageFromBlock' }
  | { kind: 'detonate'; mult: number }
  | { kind: 'multiplyStatus'; status: StatusId; mult: number };

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export type CardType = 'attack' | 'skill' | 'power';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare';

export interface CardStats {
  cost: number;
  effects: Effect[];
  exhaust?: boolean;
}

export interface CardDef extends CardStats {
  id: string;
  name: string;
  type: CardType;
  rarity: Rarity;
  upgrade: Partial<CardStats>;
  flavor?: string;
}

export interface CardInstance {
  uid: string;
  defId: string;
  upgraded: boolean;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export type UnitId = string; // 'player' or an enemy uid

export interface Unit {
  id: UnitId;
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
}

export interface PlayerUnit extends Unit {
  energy: number;
  maxEnergy: number;
}

export interface Intent {
  name: string;
  effects: Effect[];
}

export interface EnemyDef {
  id: string;
  name: string;
  glyph: string;
  hp: [number, number];
  moves: Record<string, Intent>;
  /** Moves played in order, looping. With `random`, picks randomly but never the same move twice in a row. */
  script: string[];
  random?: boolean;
  tier: 'normal' | 'elite' | 'boss';
}

export interface EnemyUnit extends Unit {
  defId: string;
  glyph: string;
  moveIndex: number;
  intent: string | null; // key into EnemyDef.moves
  lastMove: string | null;
}

// ---------------------------------------------------------------------------
// Relics
// ---------------------------------------------------------------------------

export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  starter?: boolean;
  onCombatStart?: (api: CombatApi) => void;
  onTurnStart?: (api: CombatApi) => void;
  onCardPlayed?: (api: CombatApi, card: CardInstance) => void;
  onEnemyDeath?: (api: CombatApi, enemy: UnitId) => void;
  onStatusGained?: (api: CombatApi, target: UnitId, status: StatusId, amount: number) => void;
  modifyCost?: (api: CombatApi, card: CardInstance, cost: number) => number;
  modifyStatusApply?: (source: UnitId | null, target: UnitId, status: StatusId, amount: number) => number;
  /** Run-level hook after a won combat. Returns HP to heal. */
  onCombatWon?: () => number;
}

// ---------------------------------------------------------------------------
// Combat state, events, actions
// ---------------------------------------------------------------------------

export type CombatPhase = 'player' | 'enemy' | 'won' | 'lost';

export type CombatEventBody =
  | { type: 'damage'; target: UnitId; amount: number; blocked: number; shielded: number; pierce?: boolean }
  | { type: 'block'; target: UnitId; amount: number }
  | { type: 'status'; target: UnitId; status: StatusId; amount: number }
  | { type: 'heal'; target: UnitId; amount: number }
  | { type: 'draw'; uids: string[] }
  | { type: 'shuffle' }
  | { type: 'energy'; amount: number }
  | { type: 'cardPlayed'; uid: string; defId: string; target?: UnitId }
  | { type: 'enemyAct'; enemy: UnitId; move: string }
  | { type: 'stunned'; target: UnitId }
  | { type: 'death'; target: UnitId }
  | { type: 'relic'; relicId: string }
  | { type: 'turn'; who: 'player' | 'enemy'; turn: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export type CombatEvent = CombatEventBody & { id: number };

export interface CombatState {
  player: PlayerUnit;
  enemies: EnemyUnit[];
  drawPile: CardInstance[];
  hand: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  relics: string[];
  turn: number;
  phase: CombatPhase;
  enemyCursor: number;
  cardsPlayedThisTurn: number;
  cardsPlayedThisCombat: number;
  rngState: number;
  events: CombatEvent[];
  eventSeq: number;
}

export type CombatAction =
  | { type: 'playCard'; uid: string; target?: UnitId }
  | { type: 'endTurn' }
  | { type: 'enemyStep' };

/** Mutation API handed to status and relic hooks while a combat step resolves. */
export interface CombatApi {
  state: CombatState;
  rng: Rng;
  emit(event: CombatEventBody): void;
  unit(id: UnitId): Unit | undefined;
  opponents(id: UnitId): UnitId[];
  dealDamage(source: UnitId | null, target: UnitId, amount: number): void;
  loseHp(target: UnitId, amount: number): void;
  gainBlock(target: UnitId, amount: number): void;
  applyStatus(source: UnitId | null, target: UnitId, status: StatusId, amount: number): void;
  setStatus(target: UnitId, status: StatusId, value: number): void;
  heal(target: UnitId, amount: number): void;
  draw(count: number): void;
  gainEnergy(amount: number): void;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export type NodeType = 'fight' | 'elite' | 'rest' | 'treasure' | 'boss';

export interface MapNode {
  id: string;
  row: number;
  col: number;
  type: NodeType;
  next: number[]; // columns in row + 1
}

export type Screen = 'map' | 'combat' | 'reward' | 'rest' | 'treasure' | 'victory' | 'defeat';

export interface Reward {
  cards: string[];
  relic: string | null;
  cardPicked: boolean;
  relicTaken: boolean;
}

export interface RunState {
  seed: number;
  rngState: number;
  hp: number;
  maxHp: number;
  deck: CardInstance[];
  relics: string[];
  map: MapNode[][];
  position: { row: number; col: number } | null;
  screen: Screen;
  combat: CombatState | null;
  combatNode: NodeType | null;
  reward: Reward | null;
  treasure: string | null;
  floorsCleared: number;
  nextUid: number;
}
