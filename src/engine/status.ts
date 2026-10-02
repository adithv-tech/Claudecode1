import type { StatusDef, StatusId } from './types';

/**
 * Status effects are pure data + hooks. The combat pipeline only knows to call
 * onTurnStart / onTurnEnd / modifyOutgoing / modifyIncoming in STATUS_ORDER,
 * so adding a status never touches the turn logic.
 */
export const STATUSES: Record<StatusId, StatusDef> = {
  strength: {
    id: 'strength',
    name: 'Strength',
    icon: '💪',
    kind: 'buff',
    describe: (n) => `Attacks deal ${n} additional damage.`,
    modifyOutgoing: (d, n) => d + n,
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive',
    icon: '⚡',
    kind: 'buff',
    describe: (n) => `Attacks deal 50% more damage. At end of turn, take ${2 * n} damage and lose Overdrive.`,
    modifyOutgoing: (d) => d * 1.5,
    onTurnEnd: (api, owner, n) => {
      api.setStatus(owner, 'overdrive', 0);
      api.loseHp(owner, 2 * n);
    },
  },
  weak: {
    id: 'weak',
    name: 'Weak',
    icon: '🥀',
    kind: 'debuff',
    describe: (n) => `Attacks deal 25% less damage for ${n} turn(s).`,
    modifyOutgoing: (d) => d * 0.75,
    onTurnEnd: (api, owner, n) => api.setStatus(owner, 'weak', n - 1),
  },
  vulnerable: {
    id: 'vulnerable',
    name: 'Vulnerable',
    icon: '🎯',
    kind: 'debuff',
    describe: (n) => `Takes 50% more attack damage for ${n} turn(s).`,
    modifyIncoming: (d) => d * 1.5,
    onTurnEnd: (api, owner, n) => api.setStatus(owner, 'vulnerable', n - 1),
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    icon: '🛡️',
    kind: 'buff',
    describe: (n) => `Absorbs the next ${n} damage after Block. Persists between turns, losing 1 each turn.`,
    onTurnStart: (api, owner, n) => api.setStatus(owner, 'shield', n - 1),
  },
  poison: {
    id: 'poison',
    name: 'Poison',
    icon: '☣️',
    kind: 'debuff',
    describe: (n) => `At start of turn, lose ${n} HP (ignores Block), then Poison drops by 1.`,
    onTurnStart: (api, owner, n) => {
      api.loseHp(owner, n);
      api.setStatus(owner, 'poison', n - 1);
    },
  },
  stun: {
    id: 'stun',
    name: 'Stun',
    icon: '💫',
    kind: 'debuff',
    describe: () => 'Enemies skip their next action. A stunned player draws 2 fewer cards.',
    // Consumed by the turn pipeline rather than a hook.
  },
  thorns: {
    id: 'thorns',
    name: 'Thorns',
    icon: '🌵',
    kind: 'buff',
    describe: (n) => `When attacked, deal ${n} damage back.`,
  },
  reactor: {
    id: 'reactor',
    name: 'Reactor',
    icon: '🔋',
    kind: 'buff',
    describe: (n) => `At start of turn, gain ${n} energy.`,
    onTurnStart: (api, _owner, n) => api.gainEnergy(n),
  },
  nanites: {
    id: 'nanites',
    name: 'Nanites',
    icon: '🦠',
    kind: 'buff',
    describe: (n) => `At start of turn, apply ${n} Poison to ALL enemies.`,
    onTurnStart: (api, owner, n) => {
      for (const foe of api.opponents(owner)) api.applyStatus(owner, foe, 'poison', n);
    },
  },
  aegis: {
    id: 'aegis',
    name: 'Aegis',
    icon: '🔰',
    kind: 'buff',
    describe: (n) => `At end of turn, gain ${n} Shield.`,
    onTurnEnd: (api, owner, n) => api.applyStatus(owner, owner, 'shield', n),
  },
};

/** Additive modifiers (strength) must come before multiplicative ones. */
export const STATUS_ORDER: StatusId[] = [
  'strength',
  'overdrive',
  'weak',
  'vulnerable',
  'shield',
  'poison',
  'stun',
  'thorns',
  'reactor',
  'nanites',
  'aegis',
];
