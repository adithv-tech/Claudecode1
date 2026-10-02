import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { REST_HEAL_FRACTION } from '../engine/run';
import type { RunState } from '../engine/types';
import { DeckView } from './DeckView';

export function RestScreen({ run, onHeal, onUpgrade }: { run: RunState; onHeal: () => void; onUpgrade: (uid: string) => void }) {
  const [choosing, setChoosing] = useState(false);
  const heal = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * REST_HEAL_FRACTION));
  const upgradable = run.deck.filter((c) => !c.upgraded);
  return (
    <div className="screen rest">
      <h1>🔧 Maintenance Node</h1>
      <p className="muted">A quiet subnet. Patch yourself up or optimise a routine.</p>
      <div className="choices">
        <button
          className="choice"
          onClick={() => {
            sfx('heal');
            onHeal();
          }}
          data-testid="rest-heal"
        >
          <span className="choice__icon">💚</span>
          <b>Repair</b>
          <span>Heal {heal} HP</span>
        </button>
        <button className="choice" onClick={() => setChoosing(true)} disabled={!upgradable.length} data-testid="rest-upgrade">
          <span className="choice__icon">⬆️</span>
          <b>Optimise</b>
          <span>Upgrade a card</span>
        </button>
      </div>
      {choosing && (
        <DeckView
          title="Choose a card to upgrade (hover to preview)"
          cards={run.deck}
          pickable={(c) => !c.upgraded}
          onPick={(c) => {
            sfx('buff');
            onUpgrade(c.uid);
          }}
          onClose={() => setChoosing(false)}
        />
      )}
    </div>
  );
}
