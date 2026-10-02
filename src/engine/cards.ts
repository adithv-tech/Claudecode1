import { CARDS } from './data/cards';
import { STATUSES } from './status';
import type { CardDef, CardInstance, CardStats, Effect } from './types';

export function cardDef(card: CardInstance | string): CardDef {
  const id = typeof card === 'string' ? card : card.defId;
  const def = CARDS[id];
  if (!def) throw new Error(`Unknown card ${id}`);
  return def;
}

export function cardStats(card: CardInstance | { defId: string; upgraded: boolean }): CardStats {
  const def = cardDef(card.defId);
  if (!card.upgraded) return { cost: def.cost, effects: def.effects, exhaust: def.exhaust };
  return {
    cost: def.upgrade.cost ?? def.cost,
    effects: def.upgrade.effects ?? def.effects,
    exhaust: def.upgrade.exhaust ?? def.exhaust,
  };
}

function isTargeted(e: Effect): boolean {
  switch (e.kind) {
    case 'damage':
      return e.to !== 'all';
    case 'apply':
      return e.to === 'target';
    case 'damageFromBlock':
    case 'detonate':
    case 'multiplyStatus':
      return true;
    default:
      return false;
  }
}

export function needsTarget(effects: Effect[]): boolean {
  return effects.some(isTargeted);
}

/**
 * Human-readable rules text. `dmg` lets the UI substitute live damage numbers
 * (after Strength/Weak/Overdrive) for the printed values.
 */
export function describeEffects(effects: Effect[], dmg: (base: number) => number = (b) => b): string[] {
  return effects.map((e) => {
    switch (e.kind) {
      case 'damage': {
        const times = e.times && e.times > 1 ? ` ${e.times} times` : '';
        const all = e.to === 'all' ? ' to ALL enemies' : '';
        return `Deal ${dmg(e.amount)} damage${all}${times}.`;
      }
      case 'block':
        return `Gain ${e.amount} Block.`;
      case 'apply': {
        const name = STATUSES[e.status].name;
        if (e.to === 'self') return `Gain ${e.amount} ${name}.`;
        if (e.to === 'all') return `Apply ${e.amount} ${name} to ALL enemies.`;
        return `Apply ${e.amount} ${name}.`;
      }
      case 'draw':
        return `Draw ${e.amount} card${e.amount === 1 ? '' : 's'}.`;
      case 'energy':
        return `Gain ${e.amount} energy.`;
      case 'heal':
        return `Heal ${e.amount} HP.`;
      case 'damageFromBlock':
        return 'Deal damage equal to your Block.';
      case 'detonate':
        return `Deal damage equal to ${e.mult}× the target's Poison.`;
      case 'multiplyStatus':
        return `Multiply the target's ${STATUSES[e.status].name} by ${e.mult}.`;
    }
  });
}

export function describeCard(card: CardInstance | { defId: string; upgraded: boolean }, dmg?: (base: number) => number): string {
  const stats = cardStats(card);
  const lines = describeEffects(stats.effects, dmg);
  if (cardDef(card.defId).type === 'power') lines.push('Power.');
  if (stats.exhaust) lines.push('Exhaust.');
  return lines.join(' ');
}
