import { combatReducer, startCombat } from './combat';
import { DRAFTABLE, STARTER_DECK } from './data/cards';
import { ENCOUNTERS } from './data/enemies';
import { RELICS, RELIC_POOL } from './data/relics';
import { Rng } from './rng';
import type { CardInstance, CombatAction, MapNode, NodeType, Rarity, Reward, RunState } from './types';

export const MAP_ROWS = 8; // rows 0..6 are regular floors, row 7 is the boss
const MAP_COLS = 3;
const START_HP = 70;

const ROW_POOLS: NodeType[][] = [
  ['fight', 'fight', 'fight'],
  ['fight', 'fight', 'treasure'],
  ['fight', 'elite', 'rest'],
  ['fight', 'treasure', 'fight', 'elite'],
  ['fight', 'elite', 'rest'],
  ['fight', 'fight', 'treasure', 'elite'],
  ['rest', 'rest', 'rest'],
];

export function generateMap(rng: Rng): MapNode[][] {
  const map: MapNode[][] = ROW_POOLS.map((pool, row) => {
    const types = rng.shuffle([...pool]).slice(0, MAP_COLS);
    return types.map((type, col) => ({
      id: `${row}-${col}`,
      row,
      col,
      type,
      next: row === ROW_POOLS.length - 1 ? [1] : [col - 1, col, col + 1].filter((c) => c >= 0 && c < MAP_COLS),
    }));
  });
  map.push([{ id: `${MAP_ROWS - 1}-1`, row: MAP_ROWS - 1, col: 1, type: 'boss', next: [] }]);
  return map;
}

export function findNode(run: RunState, row: number, col: number): MapNode | undefined {
  return run.map[row]?.find((n) => n.col === col);
}

export function availableNodes(run: RunState): MapNode[] {
  if (!run.position) return run.map[0];
  const cur = findNode(run, run.position.row, run.position.col);
  if (!cur) return [];
  return cur.next.map((c) => findNode(run, run.position!.row + 1, c)).filter((n): n is MapNode => !!n);
}

function makeCard(run: RunState, defId: string, upgraded = false): CardInstance {
  run.nextUid += 1;
  return { uid: `c${run.nextUid}`, defId, upgraded };
}

export function newRun(seed: number): RunState {
  const rng = new Rng(seed);
  const run: RunState = {
    seed,
    rngState: 0,
    hp: START_HP,
    maxHp: START_HP,
    deck: [],
    relics: ['heat_sink'],
    map: generateMap(rng),
    position: null,
    screen: 'map',
    combat: null,
    combatNode: null,
    reward: null,
    treasure: null,
    floorsCleared: 0,
    nextUid: 0,
  };
  run.deck = STARTER_DECK.map((id) => makeCard(run, id));
  run.rngState = rng.state;
  return run;
}

function rollCardChoices(rng: Rng, elite: boolean): string[] {
  const weights: [Rarity, number][] = elite
    ? [['common', 45], ['uncommon', 40], ['rare', 15]]
    : [['common', 60], ['uncommon', 32], ['rare', 8]];
  const picks: string[] = [];
  while (picks.length < 3) {
    const rarity = rng.weighted(weights);
    const pool = DRAFTABLE.filter((c) => c.rarity === rarity && !picks.includes(c.id));
    if (pool.length) picks.push(rng.pick(pool).id);
  }
  return picks;
}

function rollRelic(rng: Rng, owned: string[]): string | null {
  const pool = RELIC_POOL.filter((id) => !owned.includes(id));
  return pool.length ? rng.pick(pool) : null;
}

export type RunAction =
  | { type: 'selectNode'; row: number; col: number }
  | { type: 'combat'; action: CombatAction }
  | { type: 'finishCombat' }
  | { type: 'pickCard'; defId: string }
  | { type: 'takeRelic' }
  | { type: 'leaveReward' }
  | { type: 'restHeal' }
  | { type: 'restUpgrade'; uid: string }
  | { type: 'takeTreasure' }
  | { type: 'newRun'; seed: number };

export const REST_HEAL_FRACTION = 0.3;

export function runReducer(prev: RunState, action: RunAction): RunState {
  if (action.type === 'newRun') return newRun(action.seed);

  const run: RunState = { ...prev };
  const rng = new Rng(run.rngState);

  switch (action.type) {
    case 'selectNode': {
      if (run.screen !== 'map') return prev;
      const node = availableNodes(run).find((n) => n.row === action.row && n.col === action.col);
      if (!node) return prev;
      run.position = { row: node.row, col: node.col };
      if (node.type === 'rest') run.screen = 'rest';
      else if (node.type === 'treasure') {
        run.screen = 'treasure';
        run.treasure = rollRelic(rng, run.relics);
      } else {
        const tier = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : node.row < 2 ? 'easy' : 'hard';
        run.combatNode = node.type;
        run.screen = 'combat';
        run.combat = startCombat({
          deck: run.deck,
          hp: run.hp,
          maxHp: run.maxHp,
          relics: run.relics,
          enemies: rng.pick(ENCOUNTERS[tier]),
          seed: Math.floor(rng.next() * 2 ** 31),
        });
      }
      break;
    }

    case 'combat': {
      if (!run.combat) return prev;
      const next = combatReducer(run.combat, action.action);
      if (next === run.combat) return prev;
      run.combat = next;
      run.hp = next.player.hp;
      break;
    }

    case 'finishCombat': {
      const c = run.combat;
      if (!c || (c.phase !== 'won' && c.phase !== 'lost')) return prev;
      run.combat = null;
      if (c.phase === 'lost') {
        run.hp = 0;
        run.screen = 'defeat';
        break;
      }
      let hp = c.player.hp;
      for (const id of run.relics) hp += RELICS[id]?.onCombatWon?.() ?? 0;
      run.hp = Math.min(run.maxHp, hp);
      run.floorsCleared += 1;
      if (run.combatNode === 'boss') {
        run.screen = 'victory';
        break;
      }
      const elite = run.combatNode === 'elite';
      const reward: Reward = {
        cards: rollCardChoices(rng, elite),
        relic: elite ? rollRelic(rng, run.relics) : null,
        cardPicked: false,
        relicTaken: false,
      };
      run.reward = reward;
      run.screen = 'reward';
      break;
    }

    case 'pickCard': {
      if (!run.reward || run.reward.cardPicked || !run.reward.cards.includes(action.defId)) return prev;
      run.deck = [...run.deck, makeCard(run, action.defId)];
      run.reward = { ...run.reward, cardPicked: true };
      break;
    }

    case 'takeRelic': {
      if (!run.reward?.relic || run.reward.relicTaken) return prev;
      run.relics = [...run.relics, run.reward.relic];
      run.reward = { ...run.reward, relicTaken: true };
      break;
    }

    case 'leaveReward':
      if (run.screen !== 'reward') return prev;
      run.reward = null;
      run.screen = 'map';
      break;

    case 'restHeal':
      if (run.screen !== 'rest') return prev;
      run.hp = Math.min(run.maxHp, run.hp + Math.ceil(run.maxHp * REST_HEAL_FRACTION));
      run.floorsCleared += 1;
      run.screen = 'map';
      break;

    case 'restUpgrade': {
      if (run.screen !== 'rest') return prev;
      const target = run.deck.find((c) => c.uid === action.uid && !c.upgraded);
      if (!target) return prev;
      run.deck = run.deck.map((c) => (c.uid === action.uid ? { ...c, upgraded: true } : c));
      run.floorsCleared += 1;
      run.screen = 'map';
      break;
    }

    case 'takeTreasure':
      if (run.screen !== 'treasure') return prev;
      if (run.treasure) run.relics = [...run.relics, run.treasure];
      else run.hp = Math.min(run.maxHp, run.hp + 10);
      run.treasure = null;
      run.floorsCleared += 1;
      run.screen = 'map';
      break;
  }

  run.rngState = rng.state;
  return run;
}
