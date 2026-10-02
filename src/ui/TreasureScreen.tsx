import { motion } from 'framer-motion';
import { useState } from 'react';
import { sfx } from '../audio/sfx';
import { RELICS } from '../engine/data/relics';

export function TreasureScreen({ relicId, onTake }: { relicId: string | null; onTake: () => void }) {
  const [open, setOpen] = useState(false);
  const relic = relicId ? RELICS[relicId] : null;
  return (
    <div className="screen treasure">
      <h1>📦 Data Cache</h1>
      {!open ? (
        <motion.button
          className="chest"
          whileHover={{ scale: 1.08, rotate: [0, -3, 3, 0] }}
          onClick={() => {
            sfx('buff');
            setOpen(true);
          }}
          data-testid="open-chest"
        >
          📦
          <span>Decrypt</span>
        </motion.button>
      ) : (
        <motion.div className="treasure__loot" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring' }}>
          {relic ? (
            <>
              <div className="treasure__icon">{relic.icon}</div>
              <h2>{relic.name}</h2>
              <p>{relic.description}</p>
            </>
          ) : (
            <>
              <div className="treasure__icon">💚</div>
              <h2>Repair Kit</h2>
              <p>You own every relic. Heal 10 HP instead.</p>
            </>
          )}
          <button className="btn btn--primary" onClick={onTake} data-testid="take-treasure">
            Take
          </button>
        </motion.div>
      )}
    </div>
  );
}
