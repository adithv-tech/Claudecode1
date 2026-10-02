import { AnimatePresence, motion } from 'framer-motion';
import type { IntentPreview } from '../engine/combat';
import { STATUSES, STATUS_ORDER } from '../engine/status';
import type { CombatEvent, EnemyUnit, PlayerUnit, Statuses, Unit } from '../engine/types';
import { useDropZone } from './dropzones';

export function StatusBadges({ statuses }: { statuses: Statuses }) {
  return (
    <div className="statuses">
      <AnimatePresence>
        {STATUS_ORDER.filter((id) => statuses[id]).map((id) => {
          const def = STATUSES[id];
          const n = statuses[id]!;
          return (
            <motion.div
              key={id}
              className={`status status--${def.kind}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              data-tip={`${def.name}: ${def.describe(n)}`}
              tabIndex={0}
            >
              <span aria-hidden>{def.icon}</span>
              <motion.span key={n} initial={{ scale: 1.8 }} animate={{ scale: 1 }} className="status__n">
                {n}
              </motion.span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function HpBar({ unit }: { unit: Unit }) {
  const pct = (unit.hp / unit.maxHp) * 100;
  const shield = unit.statuses.shield ?? 0;
  return (
    <div className="hpbar" role="meter" aria-valuenow={unit.hp} aria-valuemax={unit.maxHp} aria-label="HP">
      <motion.div className="hpbar__lag" animate={{ width: `${pct}%` }} transition={{ delay: 0.25, duration: 0.6 }} />
      <motion.div
        className={`hpbar__fill${unit.statuses.poison ? ' hpbar__fill--poison' : ''}`}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.2 }}
      />
      <div className="hpbar__label">
        {unit.hp}/{unit.maxHp}
      </div>
      <AnimatePresence>
        {unit.block > 0 && (
          <motion.div key="block" className="hpbar__block" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <span>{unit.block}</span>
          </motion.div>
        )}
        {shield > 0 && (
          <motion.div key="shield" className="hpbar__shield" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
            <span>{shield}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Floating combat text derived purely from the event log, keyed by event id. */
export function FloatingNumbers({ events, target }: { events: CombatEvent[]; target: string }) {
  const floats = events.flatMap((e) => {
    if (e.type === 'damage' && e.target === target) {
      if (e.amount > 0) return [{ id: e.id, text: `-${e.amount}`, cls: e.pierce ? 'float--pierce' : 'float--dmg' }];
      if (e.blocked + e.shielded > 0) return [{ id: e.id, text: 'Blocked', cls: 'float--block' }];
    }
    if (e.type === 'block' && e.target === target) return [{ id: e.id, text: `+${e.amount} 🛡`, cls: 'float--block' }];
    if (e.type === 'heal' && e.target === target) return [{ id: e.id, text: `+${e.amount}`, cls: 'float--heal' }];
    if (e.type === 'status' && e.target === target)
      return [{ id: e.id, text: `${STATUSES[e.status].icon} ${STATUSES[e.status].name}`, cls: `float--${STATUSES[e.status].kind}` }];
    if (e.type === 'stunned' && e.target === target) return [{ id: e.id, text: '💫 Stunned!', cls: 'float--debuff' }];
    return [];
  });
  return (
    <div className="floats" aria-hidden>
      {floats.slice(-6).map((f, i) => (
        <motion.div
          key={f.id}
          className={`float ${f.cls}`}
          initial={{ y: 0, opacity: 0, scale: 0.6 }}
          animate={{ y: -70 - (i % 3) * 10, opacity: [0, 1, 1, 0], scale: 1 }}
          transition={{ duration: 1.1, times: [0, 0.1, 0.7, 1] }}
          style={{ left: `${30 + ((f.id * 37) % 40)}%` }}
        >
          {f.text}
        </motion.div>
      ))}
    </div>
  );
}

function lastHitId(events: CombatEvent[], target: string): number {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'damage' && e.target === target && e.amount > 0) return e.id;
  }
  return 0;
}

const INTENT_ICON = { attack: '🗡️', defend: '🛡️', buff: '⬆️', debuff: '☣️' } as const;

interface EnemyProps {
  enemy: EnemyUnit;
  intent: IntentPreview | null;
  events: CombatEvent[];
  acting: boolean;
  highlight: 'none' | 'valid' | 'hover';
  onClick: () => void;
}

export function EnemyView({ enemy, intent, events, acting, highlight, onClick }: EnemyProps) {
  const ref = useDropZone(enemy.id);
  const dead = enemy.hp <= 0;
  const hit = lastHitId(events, enemy.id);
  return (
    <motion.div
      ref={ref}
      className={`unit enemy enemy--${highlight}${dead ? ' unit--dead' : ''}`}
      onClick={dead ? undefined : onClick}
      animate={dead ? { opacity: 0, scale: 0.6, filter: 'blur(6px)' } : { opacity: 1, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.6 }}
      data-testid={`enemy-${enemy.id}`}
    >
      <div className="intent" data-tip={intent ? `Intends: ${intent.name}` : undefined} tabIndex={0}>
        {intent && (
          <motion.div key={enemy.intent} initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`intent__chip intent--${intent.kinds[0] ?? 'buff'}`}>
            {intent.kinds.map((k) => (
              <span key={k}>{INTENT_ICON[k]}</span>
            ))}
            {intent.damage !== null && (
              <b>
                {intent.damage}
                {intent.hits > 1 ? `×${intent.hits}` : ''}
              </b>
            )}
          </motion.div>
        )}
      </div>
      <motion.div
        key={hit}
        className="unit__glyph"
        animate={
          acting
            ? { x: [0, -30, 0], scale: [1, 1.15, 1] }
            : hit
              ? { x: [0, -12, 12, -8, 8, 0], filter: ['brightness(1)', 'brightness(3)', 'brightness(1)'] }
              : {}
        }
        transition={{ duration: 0.4 }}
      >
        {enemy.glyph}
      </motion.div>
      <div className="unit__name">{enemy.name}</div>
      <HpBar unit={enemy} />
      <StatusBadges statuses={enemy.statuses} />
      <FloatingNumbers events={events} target={enemy.id} />
    </motion.div>
  );
}

export function PlayerView({ player, events }: { player: PlayerUnit; events: CombatEvent[] }) {
  const hit = lastHitId(events, 'player');
  return (
    <div className="unit player" data-testid="player">
      <motion.div
        key={hit}
        className="unit__glyph unit__glyph--player"
        animate={hit ? { x: [0, -10, 10, -6, 0], filter: ['hue-rotate(0deg)', 'hue-rotate(140deg) brightness(2)', 'hue-rotate(0deg)'] } : {}}
        transition={{ duration: 0.4 }}
      >
        🧑‍💻
      </motion.div>
      <div className="unit__name">Netrunner</div>
      <HpBar unit={player} />
      <StatusBadges statuses={player.statuses} />
      <FloatingNumbers events={events} target="player" />
    </div>
  );
}

export function EnergyOrb({ energy, max }: { energy: number; max: number }) {
  return (
    <motion.div
      key={energy}
      className={`energy${energy === 0 ? ' energy--empty' : ''}`}
      initial={{ scale: 1.25 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 12 }}
      data-tip="Energy: spend it to play cards. Refills each turn."
      data-testid="energy"
    >
      {energy}/{max}
    </motion.div>
  );
}
