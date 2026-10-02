import { useState } from 'react';
import { isMuted, setMuted } from '../audio/sfx';
import { RELICS } from '../engine/data/relics';
import type { RunState } from '../engine/types';
import { DeckView } from './DeckView';

export function TopBar({ run, onQuit }: { run: RunState; onQuit: () => void }) {
  const [deckOpen, setDeckOpen] = useState(false);
  const [muted, setMutedState] = useState(isMuted);
  const hp = run.combat ? run.combat.player.hp : run.hp;
  return (
    <header className="topbar">
      <div className="topbar__brand">OVERCLOCK</div>
      <div className="topbar__stat" data-tip="Integrity (HP)">
        ❤️ {hp}/{run.maxHp}
      </div>
      <div className="topbar__stat" data-tip="Floor">
        🗺️ {Math.min((run.position?.row ?? -1) + 1, run.map.length)}/{run.map.length}
      </div>
      <div className="relics">
        {run.relics.map((id) => (
          <span key={id} className="relic" data-tip={`${RELICS[id].name}: ${RELICS[id].description}`} tabIndex={0}>
            {RELICS[id].icon}
          </span>
        ))}
      </div>
      <div className="topbar__actions">
        <button className="btn" onClick={() => setDeckOpen(true)} data-testid="open-deck">
          🃏 Deck ({run.deck.length})
        </button>
        <button
          className="btn"
          onClick={() => {
            setMuted(!muted);
            setMutedState(!muted);
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="btn" onClick={onQuit} title="Back to title (run is saved)">
          ⏏
        </button>
      </div>
      {deckOpen && <DeckView title="Your deck" cards={run.deck} onClose={() => setDeckOpen(false)} />}
    </header>
  );
}
