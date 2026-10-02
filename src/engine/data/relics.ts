import type { RelicDef } from '../types';

const defs: RelicDef[] = [
  {
    id: 'heat_sink',
    name: 'Heat Sink',
    icon: '🧊',
    starter: true,
    description: 'After each combat, heal 6 HP.',
    onCombatWon: () => 6,
  },
  {
    id: 'cache_shard',
    name: 'Cache Shard',
    icon: '💾',
    description: 'The first card you play each combat costs 0.',
    modifyCost: (api, _card, cost) => (api.state.cardsPlayedThisCombat === 0 ? 0 : cost),
  },
  {
    id: 'toxin_daemon',
    name: 'Toxin Daemon',
    icon: '🧪',
    description: 'Whenever you apply Poison, apply 1 additional.',
    modifyStatusApply: (source, target, status, amount) =>
      source === 'player' && target !== 'player' && status === 'poison' && amount > 0 ? amount + 1 : amount,
  },
  {
    id: 'firewall_core',
    name: 'Firewall Core',
    icon: '🧱',
    description: 'Start each combat with 6 Shield.',
    onCombatStart: (api) => api.applyStatus('player', 'player', 'shield', 6),
  },
  {
    id: 'overclock_chip',
    name: 'Overclock Chip',
    icon: '🔥',
    description: 'Whenever you gain Overdrive, draw 1 card.',
    onStatusGained: (api, target, status, amount) => {
      if (target === 'player' && status === 'overdrive' && amount > 0 && api.state.phase === 'player') api.draw(1);
    },
  },
  {
    id: 'kill_switch',
    name: 'Kill Switch',
    icon: '🔌',
    description: 'Whenever an enemy is destroyed, gain 1 energy.',
    onEnemyDeath: (api) => {
      if (api.state.phase === 'player') api.gainEnergy(1);
    },
  },
  {
    id: 'spare_capacitor',
    name: 'Spare Capacitor',
    icon: '🔋',
    description: 'Gain 1 extra energy on your first turn of each combat.',
    onTurnStart: (api) => {
      if (api.state.turn === 1) api.gainEnergy(1);
    },
  },
  {
    id: 'recursive_loop',
    name: 'Recursive Loop',
    icon: '🔁',
    description: 'Every third card you play in a turn draws 1 card.',
    onCardPlayed: (api) => {
      if (api.state.cardsPlayedThisTurn % 3 === 0) api.draw(1);
    },
  },
  {
    id: 'hardened_kernel',
    name: 'Hardened Kernel',
    icon: '🧠',
    description: 'Start each combat with 1 Strength.',
    onCombatStart: (api) => api.applyStatus('player', 'player', 'strength', 1),
  },
  {
    id: 'static_mesh',
    name: 'Static Mesh',
    icon: '🕸️',
    description: 'Start each combat with 3 Thorns.',
    onCombatStart: (api) => api.applyStatus('player', 'player', 'thorns', 3),
  },
  {
    id: 'null_pointer',
    name: 'Null Pointer',
    icon: '🎯',
    description: 'At the start of each combat, apply 1 Vulnerable to ALL enemies.',
    onCombatStart: (api) => {
      for (const foe of api.opponents('player')) api.applyStatus('player', foe, 'vulnerable', 1);
    },
  },
];

export const RELICS: Record<string, RelicDef> = Object.fromEntries(defs.map((d) => [d.id, d]));

export const RELIC_POOL: string[] = defs.filter((d) => !d.starter).map((d) => d.id);
