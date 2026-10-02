import { useEffect, useReducer } from 'react';
import { newRun, runReducer, type RunAction } from '../engine/run';
import type { RunState } from '../engine/types';

const SAVE_KEY = 'overclock.run.v1';

export type AppAction = RunAction | { type: 'quit' } | { type: 'resume'; run: RunState };

function appReducer(state: RunState | null, action: AppAction): RunState | null {
  switch (action.type) {
    case 'quit':
      return null;
    case 'resume':
      return action.run;
    case 'newRun':
      return newRun(action.seed);
    default:
      return state ? runReducer(state, action) : state;
  }
}

export function loadSavedRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    return run.screen === 'victory' || run.screen === 'defeat' ? null : run;
  } catch {
    return null;
  }
}

/** Run state + dispatch, autosaved to localStorage so a refresh doesn't lose progress. */
export function useGame() {
  const [run, dispatch] = useReducer(appReducer, null);

  useEffect(() => {
    if (!run) return;
    try {
      if (run.screen === 'victory' || run.screen === 'defeat') localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    } catch {
      // storage unavailable; the run simply isn't persisted
    }
  }, [run]);

  return { run, dispatch };
}
