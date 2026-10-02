import { describe, expect, it } from 'vitest';
import { attackDamage, canPlay, combatReducer, effectiveCost, previewIntent, resolveEnemyTurn, startCombat } from './combat';
import type { CardInstance, CombatState } from './types';

let uid = 0;
const card = (defId: string, upgraded = false): CardInstance => ({ uid: `t${++uid}`, defId, upgraded });

function setup(opts: { hand?: string[]; enemies?: string[]; relics?: string[]; deck?: string[]; hp?: number } = {}): CombatState {
  const s = startCombat({
    deck: (opts.deck ?? ['firewall', 'firewall', 'firewall', 'firewall', 'firewall', 'firewall', 'firewall']).map((d) => card(d)),
    hp: opts.hp ?? 70,
    maxHp: 70,
    relics: opts.relics ?? [],
    enemies: opts.enemies ?? ['sentry'],
    seed: 42,
  });
  if (opts.hand) {
    // Replace the drawn hand with a known hand for deterministic tests.
    s.discardPile.push(...s.hand);
    s.hand = opts.hand.map((d) => card(d));
  }
  return s;
}

const play = (s: CombatState, defId: string, target?: string) => {
  const c = s.hand.find((h) => h.defId === defId);
  if (!c) throw new Error(`no ${defId} in hand`);
  return combatReducer(s, { type: 'playCard', uid: c.uid, target });
};
const enemy = (s: CombatState, i = 0) => s.enemies[i];

describe('combat basics', () => {
  it('draws 5 cards and has 3 energy on turn 1', () => {
    const s = setup();
    expect(s.hand).toHaveLength(5);
    expect(s.player.energy).toBe(3);
    expect(s.turn).toBe(1);
  });

  it('is deterministic for a given seed', () => {
    const a = setup({ deck: ['ping', 'firewall', 'inject', 'overclock', 'ping', 'ping', 'firewall'] });
    uid = 0;
    const b = setup({ deck: ['ping', 'firewall', 'inject', 'overclock', 'ping', 'ping', 'firewall'] });
    expect(a.hand.map((c) => c.defId)).toEqual(b.hand.map((c) => c.defId));
    expect(a.enemies[0].hp).toBe(b.enemies[0].hp);
  });

  it('spends energy and refuses unaffordable cards', () => {
    let s = setup({ hand: ['overload_beam', 'overload_beam'] });
    const target = enemy(s).id;
    s = play(s, 'overload_beam', target);
    expect(s.player.energy).toBe(1);
    expect(canPlay(s, s.hand[0].uid, target)).toEqual({ ok: false, reason: 'energy' });
    expect(combatReducer(s, { type: 'playCard', uid: s.hand[0].uid, target })).toBe(s);
  });

  it('requires a living target for targeted cards', () => {
    const s = setup({ hand: ['ping'] });
    expect(canPlay(s, s.hand[0].uid)).toEqual({ ok: false, reason: 'target' });
    expect(canPlay(s, s.hand[0].uid, enemy(s).id).ok).toBe(true);
  });

  it('does not mutate the previous state', () => {
    const s = setup({ hand: ['ping'] });
    const hp = enemy(s).hp;
    const next = play(s, 'ping', enemy(s).id);
    expect(enemy(s).hp).toBe(hp);
    expect(enemy(next).hp).toBe(hp - 6);
  });

  it('reshuffles the discard pile when the draw pile runs out', () => {
    let s = setup({ deck: ['firewall', 'firewall', 'firewall', 'firewall', 'firewall', 'recompile', 'recompile'] });
    s = { ...s, drawPile: [], discardPile: [card('ping'), card('ping')], hand: [card('recompile')] };
    s = play(s, 'recompile');
    expect(s.hand.map((c) => c.defId)).toEqual(['ping', 'ping']);
    expect(s.events.some((e) => e.type === 'shuffle')).toBe(true);
    expect(s.exhaustPile.map((c) => c.defId)).toEqual(['recompile']);
  });

  it('discards the hand and hands control to enemies on end turn, then back', () => {
    let s = setup();
    s = combatReducer(s, { type: 'endTurn' });
    expect(s.phase).toBe('enemy');
    expect(s.hand).toHaveLength(0);
    s = resolveEnemyTurn(s);
    expect(s.phase).toBe('player');
    expect(s.turn).toBe(2);
    expect(s.hand).toHaveLength(5);
  });
});

describe('damage, block and statuses', () => {
  it('block absorbs before shield, shield before HP', () => {
    let s = setup();
    s.player.block = 3;
    s.player.statuses.shield = 4;
    s.enemies[0].intent = 'laser'; // 11 damage
    s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    // 11 - 3 block - 4 shield = 4 HP lost
    expect(s.player.hp).toBe(66);
  });

  it('shield persists across turns but decays by 1; block does not persist', () => {
    let s = setup({ hand: ['barrier_matrix', 'firewall'] });
    s = play(s, 'barrier_matrix');
    s = play(s, 'firewall');
    s.enemies[0].intent = 'charge'; // no attack
    s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    expect(s.player.block).toBe(0);
    expect(s.player.statuses.shield).toBe(4);
  });

  it('poison ticks at turn start, ignores block, and decays', () => {
    let s = setup({ hand: ['inject'] });
    const e0 = enemy(s);
    s = play(s, 'inject', e0.id);
    expect(enemy(s).statuses.poison).toBe(4);
    s.enemies[0].block = 50;
    s = combatReducer(s, { type: 'endTurn' });
    expect(enemy(s).hp).toBe(e0.hp - 4);
    expect(enemy(s).statuses.poison).toBe(3);
  });

  it('stun makes an enemy skip its intent', () => {
    let s = setup({ hand: ['stun_lance'] });
    s = play(s, 'stun_lance', enemy(s).id);
    s.enemies[0].intent = 'laser';
    s = combatReducer(s, { type: 'endTurn' });
    s = combatReducer(s, { type: 'enemyStep' });
    expect(s.player.hp).toBe(70);
    expect(s.events.some((e) => e.type === 'stunned' && e.target === s.enemies[0].id)).toBe(true);
    expect(enemy(s).statuses.stun).toBeUndefined();
  });

  it('a stunned player draws 2 fewer cards', () => {
    let s = setup();
    s.player.statuses.stun = 1;
    s.enemies[0].intent = 'charge';
    s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    expect(s.hand).toHaveLength(3);
  });

  it('overdrive multiplies damage by 1.5 and costs 2 HP per stack at end of turn', () => {
    let s = setup({ hand: ['overclock', 'ping'] });
    s = play(s, 'overclock');
    const before = enemy(s).hp;
    s = play(s, 'ping', enemy(s).id);
    expect(before - enemy(s).hp).toBe(9);
    s = combatReducer(s, { type: 'endTurn' });
    expect(s.player.hp).toBe(68);
    expect(s.player.statuses.overdrive).toBeUndefined();
  });

  it('applies strength before multipliers and vulnerable on the defender', () => {
    const src = { id: 'a', name: 'a', hp: 1, maxHp: 1, block: 0, statuses: { strength: 2, weak: 1 } };
    const dst = { id: 'b', name: 'b', hp: 1, maxHp: 1, block: 0, statuses: { vulnerable: 1 } };
    // (6 + 2) * 0.75 * 1.5 = 9
    expect(attackDamage(src, dst, 6)).toBe(9);
  });

  it('thorns reflect attack damage', () => {
    let s = setup({ hand: ['spiked_chassis'] });
    s = play(s, 'spiked_chassis');
    s.enemies[0].intent = 'laser';
    const hp = enemy(s).hp;
    s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    expect(enemy(s).hp).toBe(hp - 3);
    expect(s.exhaustPile.map((c) => c.defId)).toContain('spiked_chassis');
  });

  it('detonate and catalyst scale with poison', () => {
    let s = setup({ hand: ['inject', 'catalyst', 'payload_detonate'], enemies: ['firewall_golem'] });
    const id = enemy(s).id;
    const hp = enemy(s).hp;
    s = play(s, 'inject', id);
    s = play(s, 'catalyst', id);
    expect(enemy(s).statuses.poison).toBe(8);
    s = play(s, 'payload_detonate', id);
    expect(hp - enemy(s).hp).toBe(16);
  });

  it('wins when every enemy dies and ignores further actions', () => {
    let s = setup({ hand: ['zero_day', 'ping'], enemies: ['glitch_wisp'] });
    s = play(s, 'zero_day', enemy(s).id);
    expect(s.phase).toBe('won');
    expect(combatReducer(s, { type: 'endTurn' })).toBe(s);
  });

  it('loses when the player dies', () => {
    let s = setup({ hp: 5 });
    s.enemies[0].intent = 'laser';
    s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    expect(s.phase).toBe('lost');
  });
});

describe('relics', () => {
  it('Cache Shard makes the first card free', () => {
    const s = setup({ hand: ['overload_beam', 'overload_beam'], relics: ['cache_shard'] });
    expect(effectiveCost(s, s.hand[0])).toBe(0);
    const next = play(s, 'overload_beam', enemy(s).id);
    expect(next.player.energy).toBe(3);
    expect(effectiveCost(next, next.hand[0])).toBe(2);
  });

  it('Toxin Daemon adds 1 poison', () => {
    let s = setup({ hand: ['inject'], relics: ['toxin_daemon'] });
    s = play(s, 'inject', enemy(s).id);
    expect(enemy(s).statuses.poison).toBe(5);
  });

  it('Firewall Core, Hardened Kernel and Static Mesh set up combat statuses', () => {
    const s = setup({ relics: ['firewall_core', 'hardened_kernel', 'static_mesh'] });
    expect(s.player.statuses).toMatchObject({ shield: 6, strength: 1, thorns: 3 });
  });

  it('Overclock Chip draws when gaining overdrive', () => {
    let s = setup({ hand: ['overclock'], relics: ['overclock_chip'] });
    s = play(s, 'overclock');
    expect(s.hand).toHaveLength(3);
  });

  it('Kill Switch refunds energy on a kill', () => {
    let s = setup({ hand: ['zero_day'], enemies: ['glitch_wisp', 'firewall_golem'], relics: ['kill_switch'] });
    s = play(s, 'zero_day', enemy(s, 0).id);
    expect(s.player.energy).toBe(2);
  });

  it('Spare Capacitor grants energy on turn 1 only', () => {
    let s = setup({ relics: ['spare_capacitor'] });
    expect(s.player.energy).toBe(4);
    s.enemies[0].intent = 'charge';
    s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    expect(s.player.energy).toBe(3);
  });

  it('Recursive Loop draws on every third card', () => {
    let s = setup({ hand: ['recompile', 'exploit', 'exploit'], relics: ['recursive_loop'] });
    s.drawPile = [card('ping'), card('ping'), card('ping'), card('ping')];
    s = play(s, 'exploit', enemy(s).id);
    s = play(s, 'exploit', enemy(s).id);
    s = play(s, 'recompile'); // draws 2, then relic draws 1
    expect(s.hand).toHaveLength(3);
  });

  it('Null Pointer applies vulnerable to all enemies', () => {
    const s = setup({ enemies: ['crawler', 'glitch_wisp'], relics: ['null_pointer'] });
    expect(s.enemies.every((e) => e.statuses.vulnerable === 1)).toBe(true);
  });
});

describe('enemy intents', () => {
  it('previews damage including self-applied overdrive', () => {
    const s = setup({ enemies: ['hunter_killer'] });
    s.enemies[0].intent = 'overdrive';
    expect(previewIntent(s, s.enemies[0].id)).toMatchObject({ damage: 18, hits: 1 });
    s.enemies[0].intent = 'burst';
    expect(previewIntent(s, s.enemies[0].id)).toMatchObject({ damage: 5, hits: 3, kinds: ['attack'] });
  });

  it('scripted enemies cycle their moves', () => {
    let s = setup({ enemies: ['sentry'] });
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(s.enemies[0].intent!);
      s = resolveEnemyTurn(combatReducer(s, { type: 'endTurn' }));
    }
    expect(seen).toEqual(['charge', 'laser', 'charge', 'laser']);
  });
});
