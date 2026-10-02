import { motion } from 'framer-motion';
import { sfx } from '../audio/sfx';
import { RELICS } from '../engine/data/relics';
import type { Reward } from '../engine/types';
import { CardFace } from './CardFace';

interface Props {
  reward: Reward;
  onPick: (defId: string) => void;
  onRelic: () => void;
  onLeave: () => void;
}

export function RewardScreen({ reward, onPick, onRelic, onLeave }: Props) {
  const relic = reward.relic ? RELICS[reward.relic] : null;
  return (
    <div className="screen reward">
      <h1>Salvage</h1>
      {relic && (
        <motion.button
          className={`relic-offer${reward.relicTaken ? ' relic-offer--taken' : ''}`}
          disabled={reward.relicTaken}
          onClick={() => {
            sfx('buff');
            onRelic();
          }}
          whileHover={{ scale: 1.04 }}
        >
          <span className="relic-offer__icon">{relic.icon}</span>
          <span>
            <b>{relic.name}</b>
            <br />
            {relic.description}
          </span>
          <span className="relic-offer__cta">{reward.relicTaken ? 'Taken' : 'Take relic'}</span>
        </motion.button>
      )}
      <p className="muted">{reward.cardPicked ? 'Card added to your deck.' : 'Choose a card to add to your deck.'}</p>
      <div className="reward__cards">
        {reward.cards.map((id, i) => (
          <motion.button
            key={id}
            className="reward__card"
            disabled={reward.cardPicked}
            initial={{ y: 80, opacity: 0, rotateY: 180 }}
            animate={reward.cardPicked ? { opacity: 0.25, y: 0, rotateY: 0 } : { y: 0, opacity: 1, rotateY: 0 }}
            transition={{ delay: 0.1 + i * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
            whileHover={reward.cardPicked ? undefined : { y: -16, scale: 1.06 }}
            onClick={() => {
              sfx('play');
              onPick(id);
            }}
            data-testid={`reward-card-${i}`}
          >
            <CardFace card={{ defId: id, upgraded: false }} />
          </motion.button>
        ))}
      </div>
      <button className="btn btn--primary" onClick={onLeave} data-testid="leave-reward">
        {reward.cardPicked ? 'Continue' : 'Skip'} →
      </button>
    </div>
  );
}
