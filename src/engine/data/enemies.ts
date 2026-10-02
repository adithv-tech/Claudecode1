import type { EnemyDef } from '../types';

const defs: EnemyDef[] = [
  // --- Normal ---------------------------------------------------------------
  {
    id: 'crawler',
    name: 'Crawler Bot',
    glyph: '🕷️',
    tier: 'normal',
    hp: [18, 22],
    moves: {
      bite: { name: 'Bite', effects: [{ kind: 'damage', amount: 7 }] },
      harden: { name: 'Harden', effects: [{ kind: 'block', amount: 6 }, { kind: 'damage', amount: 3 }] },
    },
    script: ['bite', 'harden'],
    random: true,
  },
  {
    id: 'spam_daemon',
    name: 'Spam Daemon',
    glyph: '📨',
    tier: 'normal',
    hp: [14, 17],
    moves: {
      flood: { name: 'Flood', effects: [{ kind: 'damage', amount: 3, times: 2 }] },
      clog: { name: 'Clog', effects: [{ kind: 'apply', status: 'weak', amount: 1, to: 'target' }, { kind: 'damage', amount: 2 }] },
    },
    script: ['flood', 'clog', 'flood'],
  },
  {
    id: 'viral_node',
    name: 'Viral Node',
    glyph: '🧫',
    tier: 'normal',
    hp: [20, 24],
    moves: {
      infect: { name: 'Infect', effects: [{ kind: 'apply', status: 'poison', amount: 3, to: 'target' }] },
      lash: { name: 'Lash', effects: [{ kind: 'damage', amount: 6 }] },
    },
    script: ['infect', 'lash', 'lash'],
  },
  {
    id: 'sentry',
    name: 'Sentry Turret',
    glyph: '🗼',
    tier: 'normal',
    hp: [26, 30],
    moves: {
      charge: { name: 'Charge', effects: [{ kind: 'block', amount: 8 }, { kind: 'apply', status: 'strength', amount: 2, to: 'self' }] },
      laser: { name: 'Laser', effects: [{ kind: 'damage', amount: 11 }] },
    },
    script: ['charge', 'laser'],
  },
  {
    id: 'glitch_wisp',
    name: 'Glitch Wisp',
    glyph: '👾',
    tier: 'normal',
    hp: [11, 14],
    moves: {
      flicker: { name: 'Flicker', effects: [{ kind: 'damage', amount: 4 }, { kind: 'apply', status: 'vulnerable', amount: 1, to: 'target' }] },
      zap: { name: 'Zap', effects: [{ kind: 'damage', amount: 6 }] },
    },
    script: ['flicker', 'zap'],
    random: true,
  },
  {
    id: 'firewall_golem',
    name: 'Firewall Golem',
    glyph: '🗿',
    tier: 'normal',
    hp: [36, 40],
    moves: {
      slam: { name: 'Slam', effects: [{ kind: 'damage', amount: 10 }] },
      fortify: { name: 'Fortify', effects: [{ kind: 'apply', status: 'shield', amount: 10, to: 'self' }] },
      enrage: { name: 'Enrage', effects: [{ kind: 'apply', status: 'strength', amount: 2, to: 'self' }, { kind: 'damage', amount: 5 }] },
    },
    script: ['slam', 'fortify', 'enrage'],
  },

  // --- Elites ---------------------------------------------------------------
  {
    id: 'hunter_killer',
    name: 'Hunter-Killer Mk.II',
    glyph: '🤖',
    tier: 'elite',
    hp: [62, 66],
    moves: {
      lock: { name: 'Target Lock', effects: [{ kind: 'apply', status: 'vulnerable', amount: 2, to: 'target' }, { kind: 'block', amount: 10 }] },
      burst: { name: 'Burst Fire', effects: [{ kind: 'damage', amount: 5, times: 3 }] },
      overdrive: { name: 'Overdrive Strike', effects: [{ kind: 'apply', status: 'overdrive', amount: 1, to: 'self' }, { kind: 'damage', amount: 12 }] },
    },
    script: ['lock', 'burst', 'overdrive'],
  },
  {
    id: 'siren',
    name: 'Siren Protocol',
    glyph: '🧜',
    tier: 'elite',
    hp: [52, 56],
    moves: {
      lullaby: { name: 'Lullaby', effects: [{ kind: 'apply', status: 'stun', amount: 1, to: 'target' }, { kind: 'apply', status: 'shield', amount: 8, to: 'self' }] },
      toxin: { name: 'Toxin Song', effects: [{ kind: 'apply', status: 'poison', amount: 4, to: 'target' }, { kind: 'damage', amount: 5 }] },
      shriek: { name: 'Shriek', effects: [{ kind: 'damage', amount: 13 }] },
    },
    script: ['lullaby', 'toxin', 'shriek'],
  },

  // --- Boss -----------------------------------------------------------------
  {
    id: 'lich_kernel',
    name: 'The Lich Kernel',
    glyph: '💀',
    tier: 'boss',
    hp: [160, 160],
    moves: {
      pulse: { name: 'Necrotic Pulse', effects: [{ kind: 'damage', amount: 8 }, { kind: 'apply', status: 'poison', amount: 3, to: 'target' }] },
      siphon: { name: 'Soul Siphon', effects: [{ kind: 'damage', amount: 5, times: 3 }] },
      ward: { name: 'Bone Ward', effects: [{ kind: 'apply', status: 'shield', amount: 15, to: 'self' }, { kind: 'apply', status: 'strength', amount: 2, to: 'self' }] },
      doom: { name: 'Overclocked Doom', effects: [{ kind: 'apply', status: 'overdrive', amount: 1, to: 'self' }, { kind: 'damage', amount: 18 }] },
      hex: { name: 'Hex', effects: [{ kind: 'apply', status: 'weak', amount: 2, to: 'target' }, { kind: 'apply', status: 'vulnerable', amount: 2, to: 'target' }] },
    },
    script: ['pulse', 'hex', 'siphon', 'ward', 'doom'],
  },
];

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

export const ENCOUNTERS = {
  easy: [['crawler'], ['glitch_wisp', 'glitch_wisp'], ['spam_daemon', 'glitch_wisp'], ['viral_node']],
  hard: [['sentry', 'glitch_wisp'], ['firewall_golem'], ['viral_node', 'spam_daemon'], ['crawler', 'crawler'], ['sentry', 'viral_node']],
  elite: [['hunter_killer'], ['siren', 'glitch_wisp']],
  boss: [['lich_kernel']],
} satisfies Record<string, string[][]>;
