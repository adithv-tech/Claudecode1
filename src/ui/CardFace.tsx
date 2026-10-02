import { cardDef, cardStats, describeCard } from '../engine/cards';
import { CARD_ART } from './art';

interface Props {
  card: { defId: string; upgraded: boolean };
  /** Live cost (after relics); defaults to the printed cost. */
  cost?: number;
  playable?: boolean;
  selected?: boolean;
  dmg?: (base: number) => number;
}

export function CardFace({ card, cost, playable = true, selected = false, dmg }: Props) {
  const def = cardDef(card.defId);
  const stats = cardStats(card);
  const shownCost = cost ?? stats.cost;
  return (
    <div
      className={`card card--${def.type} rarity--${def.rarity}${playable ? '' : ' card--unplayable'}${selected ? ' card--selected' : ''}`}
    >
      <div className={`card__cost${shownCost < stats.cost ? ' card__cost--reduced' : ''}`}>{shownCost}</div>
      <div className="card__name">
        {def.name}
        {card.upgraded ? '+' : ''}
      </div>
      <div className="card__art" aria-hidden>
        {CARD_ART[def.id] ?? '🃏'}
      </div>
      <div className="card__type">{def.type}</div>
      <div className="card__text">{describeCard(card, dmg)}</div>
      {def.flavor && <div className="card__flavor">{def.flavor}</div>}
    </div>
  );
}
