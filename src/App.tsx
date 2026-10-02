import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState, type ReactNode } from 'react';
import { sfx } from './audio/sfx';
import { randomSeed } from './engine/rng';
import type { CombatAction } from './engine/types';
import { loadSavedRun, useGame } from './state/useGame';
import { CombatScreen } from './ui/CombatScreen';
import { EndScreen } from './ui/EndScreen';
import { MapScreen } from './ui/MapScreen';
import { RestScreen } from './ui/RestScreen';
import { RewardScreen } from './ui/RewardScreen';
import { TitleScreen } from './ui/TitleScreen';
import { TopBar } from './ui/TopBar';
import { TreasureScreen } from './ui/TreasureScreen';

export default function App() {
  const { run, dispatch } = useGame();
  const [saved, setSaved] = useState(loadSavedRun);
  const onCombatAction = useCallback((action: CombatAction) => dispatch({ type: 'combat', action }), [dispatch]);
  const quit = () => {
    setSaved(loadSavedRun());
    dispatch({ type: 'quit' });
  };

  if (!run) {
    return (
      <TitleScreen
        saved={saved}
        onStart={(seed) => dispatch({ type: 'newRun', seed })}
        onResume={(r) => dispatch({ type: 'resume', run: r })}
      />
    );
  }

  let body: ReactNode = null;
  switch (run.screen) {
    case 'map':
      body = (
        <MapScreen
          run={run}
          onSelect={(n) => {
            sfx('click');
            dispatch({ type: 'selectNode', row: n.row, col: n.col });
          }}
        />
      );
      break;
    case 'combat':
      body = run.combat && (
        <CombatScreen
          key={`${run.position?.row}-${run.position?.col}`}
          combat={run.combat}
          node={run.combatNode}
          onAction={onCombatAction}
          onFinish={() => dispatch({ type: 'finishCombat' })}
        />
      );
      break;
    case 'reward':
      body = run.reward && (
        <RewardScreen
          reward={run.reward}
          onPick={(defId) => dispatch({ type: 'pickCard', defId })}
          onRelic={() => dispatch({ type: 'takeRelic' })}
          onLeave={() => dispatch({ type: 'leaveReward' })}
        />
      );
      break;
    case 'rest':
      body = <RestScreen run={run} onHeal={() => dispatch({ type: 'restHeal' })} onUpgrade={(uid) => dispatch({ type: 'restUpgrade', uid })} />;
      break;
    case 'treasure':
      body = <TreasureScreen relicId={run.treasure} onTake={() => dispatch({ type: 'takeTreasure' })} />;
      break;
    case 'victory':
    case 'defeat':
      body = <EndScreen run={run} onNew={() => dispatch({ type: 'newRun', seed: randomSeed() })} onTitle={quit} />;
      break;
  }

  return (
    <div className="app">
      <TopBar run={run} onQuit={quit} />
      <AnimatePresence mode="wait">
        <motion.main
          key={run.screen === 'combat' ? `combat-${run.position?.row}` : run.screen}
          className="app__main"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {body}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
