import { AnimatePresence, animate, motion, useMotionValue, type PanInfo, type Variants } from 'framer-motion';
import { useContext, useMemo, useState } from 'react';
import { cardDef, cardStats } from '../engine/cards';
import type { CardInstance } from '../engine/types';
import { CardFace } from './CardFace';
import { DropZoneContext, zoneAt } from './dropzones';

export type SortMode = 'drawn' | 'cost' | 'type' | 'name';
const SORT_ORDER: SortMode[] = ['drawn', 'cost', 'type', 'name'];
const TYPE_RANK = { attack: 0, skill: 1, power: 2 } as const;

export type ExitMode = 'play' | 'discard';

interface Layout {
  x: number;
  y: number;
  rot: number;
}

const handVariants: Variants = {
  drawn: () => ({ x: -window.innerWidth / 2 + 60, y: 160, rotate: -35, scale: 0.4, opacity: 0 }),
  inHand: (l: Layout) => ({
    x: l.x,
    y: l.y,
    rotate: l.rot,
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 260, damping: 26 },
  }),
  gone: (mode: ExitMode) =>
    mode === 'discard'
      ? {
          x: window.innerWidth / 2 - 60,
          y: 160,
          rotate: 40,
          scale: 0.4,
          opacity: 0,
          transition: { duration: 0.4, ease: 'easeIn' },
        }
      : { scale: 1.25, opacity: 0, filter: 'brightness(2.2)', transition: { duration: 0.28 } },
};

interface HandProps {
  cards: CardInstance[];
  exitMode: ExitMode;
  selected: string | null;
  costOf: (card: CardInstance) => number;
  playableOf: (card: CardInstance) => boolean;
  dmg: (base: number) => number;
  onSelect: (uid: string | null) => void;
  /** Called when a card is released over a drop zone; return false to snap it back. */
  onDrop: (uid: string, zone: string | null) => boolean;
  onHoverZone: (zone: string | null) => void;
}

export function Hand({ cards, exitMode, selected, costOf, playableOf, dmg, onSelect, onDrop, onHoverZone }: HandProps) {
  const [sort, setSort] = useState<SortMode>('drawn');
  const [focus, setFocus] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const list = [...cards];
    if (sort === 'cost') list.sort((a, b) => cardStats(a).cost - cardStats(b).cost);
    if (sort === 'type') list.sort((a, b) => TYPE_RANK[cardDef(a).type] - TYPE_RANK[cardDef(b).type]);
    if (sort === 'name') list.sort((a, b) => cardDef(a).name.localeCompare(cardDef(b).name));
    return list;
  }, [cards, sort]);

  const n = sorted.length;
  const spacing = Math.min(118, 680 / Math.max(n, 1));
  const mid = (n - 1) / 2;

  return (
    <div className="hand">
      <button
        className="hand__sort"
        onClick={() => setSort(SORT_ORDER[(SORT_ORDER.indexOf(sort) + 1) % SORT_ORDER.length])}
        title="Cycle hand sort order"
      >
        ⇅ Sort: {sort}
      </button>
      <AnimatePresence custom={exitMode}>
        {sorted.map((card, i) => {
          const off = i - mid;
          const layout: Layout = { x: off * spacing, y: Math.abs(off) ** 2 * 3.5, rot: off * 4 };
          const active = focus === card.uid || selected === card.uid;
          return (
            <motion.div
              key={card.uid}
              className="hand__slot"
              custom={layout}
              variants={handVariants}
              initial="drawn"
              animate="inHand"
              exit="gone"
              style={{ zIndex: active ? 100 : i }}
              onHoverStart={() => setFocus(card.uid)}
              onHoverEnd={() => setFocus((f) => (f === card.uid ? null : f))}
            >
              <DraggableCard
                card={card}
                index={i}
                cost={costOf(card)}
                playable={playableOf(card)}
                selected={selected === card.uid}
                dmg={dmg}
                onSelect={onSelect}
                onDrop={onDrop}
                onHoverZone={onHoverZone}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

interface DraggableProps {
  card: CardInstance;
  index: number;
  cost: number;
  playable: boolean;
  selected: boolean;
  dmg: (base: number) => number;
  onSelect: (uid: string | null) => void;
  onDrop: (uid: string, zone: string | null) => boolean;
  onHoverZone: (zone: string | null) => void;
}

function DraggableCard({ card, index, cost, playable, selected, dmg, onSelect, onDrop, onHoverZone }: DraggableProps) {
  const registry = useContext(DropZoneContext);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [dragging, setDragging] = useState(false);

  const point = (info: PanInfo) => ({ x: info.point.x - window.scrollX, y: info.point.y - window.scrollY });

  const snapBack = () => {
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
    animate(y, 0, { type: 'spring', stiffness: 500, damping: 30 });
  };

  return (
    <motion.div
      className="hand__drag"
      style={{ x, y }}
      drag
      dragMomentum={false}
      onDragStart={() => {
        setDragging(true);
        onSelect(card.uid);
      }}
      onDrag={(_, info) => {
        const p = point(info);
        onHoverZone(zoneAt(registry, p.x, p.y));
      }}
      onDragEnd={(_, info) => {
        setDragging(false);
        onHoverZone(null);
        const p = point(info);
        const played = onDrop(card.uid, zoneAt(registry, p.x, p.y));
        if (!played) snapBack();
      }}
      onTap={() => onSelect(selected ? null : card.uid)}
      whileDrag={{ scale: 1.08, rotate: 0, cursor: 'grabbing' }}
      data-testid={`hand-card-${index}`}
      data-card={card.defId}
    >
      <motion.div
        className="hand__face"
        animate={{ y: selected && !dragging ? -60 : 0, scale: selected && !dragging ? 1.1 : 1 }}
        whileHover={dragging ? undefined : { y: -48, scale: 1.12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      >
        <CardFace card={card} cost={cost} playable={playable} selected={selected} dmg={dmg} />
      </motion.div>
    </motion.div>
  );
}
