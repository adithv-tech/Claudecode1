import { motion } from 'framer-motion';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { randomSeed } from '../engine/rng';
import type { RunState } from '../engine/types';
import { CardFace } from './CardFace';

interface Props {
  saved: RunState | null;
  onStart: (seed: number) => void;
  onResume: (run: RunState) => void;
}

const SHOWCASE = ['zero_day', 'overclock', 'barrier_matrix', 'nanite_swarm', 'stun_lance'];

export function TitleScreen({ saved, onStart, onResume }: Props) {
  const [seed, setSeed] = useState('');
  return (
    <div className="screen title">
      <motion.h1 className="title__logo" initial={{ opacity: 0, letterSpacing: '1em' }} animate={{ opacity: 1, letterSpacing: '0.18em' }} transition={{ duration: 1 }}>
        OVERCLOCK
      </motion.h1>
      <p className="title__tag">A deckbuilding breach into the rogue AI core.</p>
      <div className="title__fan" aria-hidden>
        {SHOWCASE.map((id, i) => (
          <motion.div
            key={id}
            className="title__card"
            initial={{ y: 200, opacity: 0, rotate: 0 }}
            animate={{ y: Math.abs(i - 2) * 14, opacity: 1, rotate: (i - 2) * 8 }}
            transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 120, damping: 14 }}
            whileHover={{ y: -30, scale: 1.08, zIndex: 10 }}
          >
            <CardFace card={{ defId: id, upgraded: false }} />
          </motion.div>
        ))}
      </div>
      <div className="title__actions">
        {saved && (
          <button className="btn btn--primary" onClick={() => onResume(saved)} data-testid="resume">
            Resume run
          </button>
        )}
        <button
          className={saved ? 'btn' : 'btn btn--primary'}
          onClick={() => {
            sfx('turn');
            const parsed = Number.parseInt(seed, 10);
            onStart(Number.isFinite(parsed) ? parsed : randomSeed());
          }}
          data-testid="new-run"
        >
          New run
        </button>
        <input className="seed" placeholder="seed (optional)" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} aria-label="Seed" />
      </div>
      <details className="howto">
        <summary>How to play</summary>
        <ul>
          <li>Drag a card onto an enemy (or click the card, then the enemy) to play it. Skills and powers can be dropped anywhere on the battlefield.</li>
          <li>Each card costs energy ⚡ — you get 3 per turn. Press <kbd>E</kbd> to end your turn; keys <kbd>1</kbd>–<kbd>9</kbd> select cards.</li>
          <li>Enemy intents above their heads show what they'll do next. Block 🧱 fades each turn; Shield 🛡️ persists and decays slowly.</li>
          <li>Poison ☣️ ignores block. Stun 💫 cancels an enemy action. Overdrive ⚡ boosts damage 50% but burns HP at end of turn.</li>
          <li>Win fights to draft new cards, rest to heal or upgrade, crack data caches for relics, and purge the Lich Kernel.</li>
        </ul>
      </details>
    </div>
  );
}
