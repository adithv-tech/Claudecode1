import { describe, expect, it } from 'vitest';
import { resolveEnemyTurn } from './combat';
import { MAP_ROWS, availableNodes, newRun, runReducer } from './run';
import type { RunState } from './types';

function winCombat(run: RunState): RunState {
  const c = run.combat!;
  for (const e of c.enemies) e.hp = 1;
  c.drawPile = [];
  c.hand = [{ uid: 'cheat', defId: 'cleave_protocol', upgraded: false }];
  return runReducer(run, { type: 'combat', action: { type: 'playCard', uid: 'cheat' } });
}

describe('run', () => {
  it('starts with the starter deck, a starter relic and a map ending in a boss', () => {
    const run = newRun(1);
    expect(run.deck).toHaveLength(11);
    expect(run.relics).toEqual(['heat_sink']);
    expect(run.map).toHaveLength(MAP_ROWS);
    expect(run.map[MAP_ROWS - 1][0].type).toBe('boss');
    expect(availableNodes(run)).toHaveLength(3);
  });

  it('can be played from the first floor to victory over the boss', () => {
    let run = newRun(7);
    for (let row = 0; row < MAP_ROWS; row++) {
      const node = availableNodes(run)[0];
      run = runReducer(run, { type: 'selectNode', row: node.row, col: node.col });
      if (run.screen === 'combat') {
        run = winCombat(run);
        expect(run.combat!.phase).toBe('won');
        run = runReducer(run, { type: 'finishCombat' });
        if (run.screen === 'reward') {
          expect(run.reward!.cards).toHaveLength(3);
          const size = run.deck.length;
          run = runReducer(run, { type: 'pickCard', defId: run.reward!.cards[0] });
          expect(run.deck).toHaveLength(size + 1);
          if (run.reward!.relic) run = runReducer(run, { type: 'takeRelic' });
          run = runReducer(run, { type: 'leaveReward' });
        }
      } else if (run.screen === 'rest') {
        const target = run.deck.find((c) => !c.upgraded)!;
        run = runReducer(run, { type: 'restUpgrade', uid: target.uid });
        expect(run.deck.find((c) => c.uid === target.uid)!.upgraded).toBe(true);
      } else if (run.screen === 'treasure') {
        run = runReducer(run, { type: 'takeTreasure' });
      }
    }
    expect(run.screen).toBe('victory');
  });

  it('moves to defeat when the player dies', () => {
    let run = newRun(3);
    const node = availableNodes(run)[0];
    run = runReducer(run, { type: 'selectNode', row: node.row, col: node.col });
    run.combat!.player.hp = 1;
    run.combat!.player.statuses.poison = 5;
    run = runReducer(run, { type: 'combat', action: { type: 'endTurn' } });
    run = { ...run, combat: resolveEnemyTurn(run.combat!) };
    expect(run.combat!.phase).toBe('lost');
    run = runReducer(run, { type: 'finishCombat' });
    expect(run.screen).toBe('defeat');
  });

  it('rejects moves to unconnected nodes', () => {
    const run = newRun(5);
    expect(runReducer(run, { type: 'selectNode', row: 3, col: 0 })).toBe(run);
  });

  it('heals 30% at rest and applies Heat Sink after combat', () => {
    let run = newRun(11);
    const node = availableNodes(run)[0];
    run = runReducer(run, { type: 'selectNode', row: node.row, col: node.col });
    run.combat!.player.hp = 40;
    run = winCombat(run);
    run = runReducer(run, { type: 'finishCombat' });
    expect(run.hp).toBe(46);
    run = { ...run, screen: 'rest' };
    run = runReducer(run, { type: 'restHeal' });
    expect(run.hp).toBe(67);
  });
});
