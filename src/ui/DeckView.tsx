import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { CardInstance } from '../engine/types';
import { CardFace } from './CardFace';

interface Props {
  title: string;
  cards: CardInstance[];
  onClose: () => void;
  /** When set, cards become buttons (used for upgrades) and hovering previews the upgrade. */
  onPick?: (card: CardInstance) => void;
  pickable?: (card: CardInstance) => boolean;
}

export function DeckView({ title, cards, onClose, onPick, pickable }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="modal__head">
          <h2>
            {title} <small>({cards.length})</small>
          </h2>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </header>
        {cards.length === 0 && <p className="muted">Empty.</p>}
        <div className="card-grid">
          {cards.map((c, i) => {
            const can = onPick && (pickable?.(c) ?? true);
            const preview = can && hover === c.uid ? { ...c, upgraded: true } : c;
            return (
              <motion.button
                key={c.uid}
                className="card-grid__item"
                disabled={!can}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.3) }}
                whileHover={can ? { y: -8, scale: 1.04 } : undefined}
                onHoverStart={() => setHover(c.uid)}
                onHoverEnd={() => setHover(null)}
                onClick={() => can && onPick!(c)}
              >
                <CardFace card={preview} playable={!onPick || !!can} />
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
