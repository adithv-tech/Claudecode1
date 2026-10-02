import { motion } from 'framer-motion';
import type { RunState } from '../engine/types';

export function EndScreen({ run, onNew, onTitle }: { run: RunState; onNew: () => void; onTitle: () => void }) {
  const won = run.screen === 'victory';
  return (
    <div className="screen end">
      <motion.h1 className={won ? 'glow-good' : 'glow-bad'} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        {won ? 'KERNEL PURGED' : 'SYSTEM FAILURE'}
      </motion.h1>
      <p>{won ? 'The Lich Kernel collapses into static. The network is free.' : 'Your process was terminated.'}</p>
      <dl className="stats">
        <dt>Floors cleared</dt>
        <dd>{run.floorsCleared}</dd>
        <dt>Deck size</dt>
        <dd>{run.deck.length}</dd>
        <dt>Relics</dt>
        <dd>{run.relics.length}</dd>
        <dt>Seed</dt>
        <dd>{run.seed}</dd>
      </dl>
      <div className="title__actions">
        <button className="btn btn--primary" onClick={onNew}>
          New run
        </button>
        <button className="btn" onClick={onTitle}>
          Title
        </button>
      </div>
    </div>
  );
}
