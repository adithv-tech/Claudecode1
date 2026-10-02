import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sfx } from '../audio/sfx';
import type { SfxName } from '../audio/synth';
import { cardStats, needsTarget } from '../engine/cards';
import { attackDamage, canPlay, effectiveCost, previewIntent } from '../engine/combat';
import { STATUSES } from '../engine/status';
import type { CardInstance, CombatAction, CombatEvent, CombatState, NodeType } from '../engine/types';
import { DeckView } from './DeckView';
import { DropZoneContext, PLAY_ZONE, useDropZone, type ZoneRegistry } from './dropzones';
import { Hand, type ExitMode } from './Hand';
import { EnemyView, EnergyOrb, PlayerView } from './Units';

const ENEMY_STEP_MS = 700;

interface Props {
  combat: CombatState;
  node: NodeType | null;
  onAction: (action: CombatAction) => void;
  onFinish: () => void;
}

function soundsFor(events: CombatEvent[]): [SfxName, number][] {
  const out = new Map<SfxName, number>();
  const add = (name: SfxName, rate = 1) => {
    if (!out.has(name)) out.set(name, rate);
  };
  for (const e of events) {
    switch (e.type) {
      case 'damage':
        if (e.pierce) add('poison', 0.8);
        else if (e.amount >= 15) add('heavyHit');
        else if (e.amount > 0) add('hit', 0.9 + Math.random() * 0.25);
        else add('block', 1.3);
        break;
      case 'block':
        add('block');
        break;
      case 'status':
        if (e.status === 'shield') add('shield');
        else if (e.status === 'poison') add('poison');
        else if (e.status === 'stun') add('stun');
        else add(STATUSES[e.status].kind === 'buff' ? 'buff' : 'debuff');
        break;
      case 'stunned':
        add('stun', 0.8);
        break;
      case 'heal':
        add('heal');
        break;
      case 'draw':
        add('draw', 0.95 + Math.random() * 0.1);
        break;
      case 'energy':
        add('energy');
        break;
      case 'cardPlayed':
        add('play');
        break;
      case 'death':
        add('death');
        break;
      case 'victory':
        add('victory');
        break;
      case 'defeat':
        add('defeat');
        break;
      case 'turn':
        if (e.who === 'player') add('turn');
        break;
    }
  }
  return [...out];
}

const REASON_TEXT = {
  energy: 'Not enough energy',
  target: 'Drag onto an enemy to target it',
  phase: 'Wait for your turn',
  missing: 'Card is gone',
} as const;

export function CombatScreen({ combat, node, onAction, onFinish }: Props) {
  const [registry] = useState<ZoneRegistry>(() => new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [pileView, setPileView] = useState<'draw' | 'discard' | 'exhaust' | null>(null);
  const seen = useRef(0);
  const noticeTimer = useRef<number | undefined>(undefined);

  const { player, enemies, hand, phase, events } = combat;
  const living = enemies.filter((e) => e.hp > 0);
  const selectedCard = hand.find((c) => c.uid === selected) ?? null;
  const selectedNeedsTarget = selectedCard ? needsTarget(cardStats(selectedCard).effects) : false;
  const exitMode: ExitMode = phase === 'enemy' ? 'discard' : 'play';
  const lastEvent = events[events.length - 1];
  const actingEnemy = phase === 'enemy' && lastEvent?.type === 'enemyAct' ? lastEvent.enemy : null;

  // Sound cues for every new event since the last render.
  useEffect(() => {
    const fresh = events.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = fresh[fresh.length - 1].id;
    for (const [name, rate] of soundsFor(fresh)) sfx(name, rate);
  }, [events]);

  // Enemy turn plays out one enemy at a time so each action can animate.
  useEffect(() => {
    if (phase !== 'enemy') return;
    const t = window.setTimeout(() => onAction({ type: 'enemyStep' }), ENEMY_STEP_MS);
    return () => window.clearTimeout(t);
  }, [phase, combat.eventSeq, onAction]);

  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const flash = useCallback((text: string) => {
    sfx('error');
    setNotice({ id: Date.now(), text });
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 1400);
  }, []);

  const tryPlay = useCallback(
    (uid: string, target?: string): boolean => {
      const check = canPlay(combat, uid, target);
      if (!check.ok) {
        flash(REASON_TEXT[check.reason]);
        return false;
      }
      onAction({ type: 'playCard', uid, target });
      setSelected(null);
      return true;
    },
    [combat, onAction, flash],
  );

  const onDrop = useCallback(
    (uid: string, zone: string | null): boolean => {
      if (!zone) return false; // released back over the hand: just snap back
      const card = hand.find((c) => c.uid === uid);
      if (!card) return false;
      if (!needsTarget(cardStats(card).effects)) return tryPlay(uid);
      if (zone !== PLAY_ZONE) return tryPlay(uid, zone);
      if (living.length === 1) return tryPlay(uid, living[0].id);
      flash(REASON_TEXT.target);
      return false;
    },
    [hand, living, tryPlay, flash],
  );

  const endTurn = useCallback(() => {
    if (phase !== 'player') return;
    setSelected(null);
    onAction({ type: 'endTurn' });
  }, [phase, onAction]);

  // Keyboard: 1-9 select, E end turn, Esc cancel, Enter plays a selected untargeted card.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'e' || ev.key === 'E') endTurn();
      else if (ev.key === 'Escape') setSelected(null);
      else if (ev.key === 'Enter' && selectedCard && !selectedNeedsTarget) tryPlay(selectedCard.uid);
      else if (/^[1-9]$/.test(ev.key)) {
        const c = hand[Number(ev.key) - 1];
        if (c) setSelected((s) => (s === c.uid ? null : c.uid));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [endTurn, hand, selectedCard, selectedNeedsTarget, tryPlay]);

  const intents = useMemo(() => Object.fromEntries(enemies.map((e) => [e.id, previewIntent(combat, e.id)])), [combat, enemies]);
  const costOf = useCallback((c: CardInstance) => effectiveCost(combat, c), [combat]);
  const playableOf = useCallback((c: CardInstance) => phase === 'player' && effectiveCost(combat, c) <= player.energy, [combat, phase, player.energy]);
  const dmg = useCallback((base: number) => attackDamage(player, null, base), [player]);

  const draggingUntargeted = hoverZone !== null && selectedCard && !selectedNeedsTarget;
  const over = phase === 'won' || phase === 'lost';

  return (
    <DropZoneContext.Provider value={registry}>
      <div className={`combat combat--${node ?? 'fight'}`}>
        <Battlefield
          active={!!draggingUntargeted || (!!selectedCard && !selectedNeedsTarget)}
          onClick={() => {
            if (selectedCard && !selectedNeedsTarget) tryPlay(selectedCard.uid);
          }}
        >
          <div className="combat__player">
            <PlayerView player={player} events={events} />
          </div>
          <div className="combat__enemies">
            {enemies.map((e) => (
              <EnemyView
                key={e.id}
                enemy={e}
                intent={intents[e.id]}
                events={events}
                acting={actingEnemy === e.id}
                highlight={selectedNeedsTarget && e.hp > 0 ? (hoverZone === e.id ? 'hover' : 'valid') : 'none'}
                onClick={() => {
                  if (selectedCard && selectedNeedsTarget) tryPlay(selectedCard.uid, e.id);
                }}
              />
            ))}
          </div>
          <AnimatePresence>
            {phase === 'enemy' && (
              <motion.div className="banner" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                Enemy turn
              </motion.div>
            )}
            {notice && (
              <motion.div key={notice.id} className="notice" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                {notice.text}
              </motion.div>
            )}
          </AnimatePresence>
        </Battlefield>

        <div className="tableau">
          <div className="tableau__left">
            <EnergyOrb energy={player.energy} max={player.maxEnergy} />
            <button className="pile pile--draw" onClick={() => setPileView('draw')} data-tip="Draw pile">
              🂠 <b>{combat.drawPile.length}</b>
            </button>
          </div>
          <Hand
            cards={hand}
            exitMode={exitMode}
            selected={selected}
            costOf={costOf}
            playableOf={playableOf}
            dmg={dmg}
            onSelect={setSelected}
            onDrop={onDrop}
            onHoverZone={setHoverZone}
          />
          <div className="tableau__right">
            <button className="end-turn" onClick={endTurn} disabled={phase !== 'player'} data-testid="end-turn">
              End Turn <kbd>E</kbd>
            </button>
            <div className="piles">
              <button className="pile pile--discard" onClick={() => setPileView('discard')} data-tip="Discard pile">
                🗑 <b>{combat.discardPile.length}</b>
              </button>
              {combat.exhaustPile.length > 0 && (
                <button className="pile pile--exhaust" onClick={() => setPileView('exhaust')} data-tip="Exhausted / powers">
                  🔥 <b>{combat.exhaustPile.length}</b>
                </button>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {over && (
            <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              <motion.div className="overlay__panel" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: 'spring' }}>
                <h2 className={phase === 'won' ? 'glow-good' : 'glow-bad'}>{phase === 'won' ? 'THREAT PURGED' : 'CONNECTION TERMINATED'}</h2>
                <button className="btn btn--primary" onClick={onFinish} autoFocus data-testid="finish-combat">
                  Continue
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {pileView && (
          <DeckView
            title={{ draw: 'Draw pile (random order)', discard: 'Discard pile', exhaust: 'Exhausted & powers' }[pileView]}
            cards={pileView === 'draw' ? [...combat.drawPile].sort((a, b) => a.defId.localeCompare(b.defId)) : pileView === 'discard' ? combat.discardPile : combat.exhaustPile}
            onClose={() => setPileView(null)}
          />
        )}
      </div>
    </DropZoneContext.Provider>
  );
}

function Battlefield({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  const ref = useDropZone(PLAY_ZONE);
  return (
    <div ref={ref} className={`battlefield${active ? ' battlefield--active' : ''}`} onClick={onClick}>
      {children}
    </div>
  );
}
