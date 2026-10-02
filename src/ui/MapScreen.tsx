import { motion } from 'framer-motion';
import { availableNodes } from '../engine/run';
import type { MapNode, RunState } from '../engine/types';
import { NODE_ICONS, NODE_LABELS } from './art';

const COL_X = [20, 50, 80];
const ROW_H = 84;

export function MapScreen({ run, onSelect }: { run: RunState; onSelect: (node: MapNode) => void }) {
  const avail = new Set(availableNodes(run).map((n) => n.id));
  const rows = run.map.length;
  const height = rows * ROW_H + 40;
  const yOf = (row: number) => height - 50 - row * ROW_H;
  const visitedRow = run.position?.row ?? -1;
  const isCurrent = (n: MapNode) => run.position?.row === n.row && run.position.col === n.col;

  return (
    <div className="map">
      <div className="map__legend">
        {(Object.keys(NODE_ICONS) as (keyof typeof NODE_ICONS)[]).map((t) => (
          <span key={t}>
            {NODE_ICONS[t]} {NODE_LABELS[t]}
          </span>
        ))}
      </div>
      <div className="map__scroll">
        <div className="map__board" style={{ height }}>
          <svg className="map__lines" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
            {run.map.flatMap((row) =>
              row.flatMap((n) =>
                n.next.map((c) => {
                  const to = run.map[n.row + 1]?.find((m) => m.col === c);
                  if (!to) return null;
                  const taken = isCurrent(n) && avail.has(to.id);
                  return (
                    <line
                      key={`${n.id}>${to.id}`}
                      x1={COL_X[n.col]}
                      y1={yOf(n.row)}
                      x2={COL_X[to.col]}
                      y2={yOf(to.row)}
                      className={taken ? 'map__line map__line--open' : 'map__line'}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }),
              ),
            )}
          </svg>
          {run.map.flat().map((n) => {
            const open = avail.has(n.id);
            const past = n.row <= visitedRow;
            return (
              <motion.button
                key={n.id}
                className={`map__node map__node--${n.type}${open ? ' map__node--open' : ''}${isCurrent(n) ? ' map__node--here' : ''}${past && !isCurrent(n) ? ' map__node--past' : ''}`}
                style={{ left: `${COL_X[n.col]}%`, top: yOf(n.row) }}
                disabled={!open}
                onClick={() => onSelect(n)}
                animate={open ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                transition={open ? { repeat: Infinity, duration: 1.4 } : undefined}
                whileHover={open ? { scale: 1.3 } : undefined}
                data-tip={NODE_LABELS[n.type]}
                data-testid={open ? 'map-node-open' : undefined}
              >
                {NODE_ICONS[n.type]}
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
