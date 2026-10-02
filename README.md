# Overclock — Modular Deckbuilder

A single-player, turn-based card battler in the style of *Slay the Spire*. You play a netrunner breaching a rogue AI network: draft tactical cards, manage energy, stack status effects, collect relics, and purge **The Lich Kernel**.

**Stack:** React 18 · TypeScript (strict) · Vite · Framer Motion (card draw/play/drag animations) · Howler.js (sound) · Vitest.

```bash
npm install
npm run dev      # play at http://localhost:5173
npm test         # engine unit tests
npm run build    # typecheck + production build
npm run lint
```

## How to play

- **Drag** a card onto an enemy to play it. Skills and powers can be dropped anywhere on the battlefield. You can also **click** a card and then click an enemy, or use the keyboard: <kbd>1</kbd>–<kbd>9</kbd> selects a card, <kbd>Enter</kbd> plays an untargeted card, <kbd>E</kbd> ends your turn and <kbd>Esc</kbd> cancels.
- You get 3 energy ⚡ per turn and draw 5 cards. Unaffordable cards are dimmed, and an invalid drop springs the card back to your hand.
- The icon above each enemy shows its next **intent**. Damage numbers already include its buffs and your debuffs.
- Use **Sort** to cycle the hand order: as drawn, then by cost, by type, or by name.
- The map has branching paths through fights, elites, rest sites (heal 30% or upgrade a card), data caches (relics), and the boss.
- The run autosaves to `localStorage`. Use ⏏ to return to the title screen and resume later. Enter a seed on the title screen to get a reproducible run.

### Status effects

| Status | Effect |
| --- | --- |
| 🛡️ Shield | Absorbs damage after Block. Unlike Block, it persists between turns, losing 1 per turn. |
| 💫 Stun | An enemy skips its next action. A stunned player draws 2 fewer cards. |
| ☣️ Poison | Lose N HP at turn start, ignoring Block. Poison then drops by 1. |
| ⚡ Overdrive | +50% attack damage. At end of turn you take 2 damage per stack and Overdrive is removed. |
| 🎯 Vulnerable / 🥀 Weak | Take 50% more damage / deal 25% less damage. |
| 💪 Strength, 🌵 Thorns | Flat bonus to attack damage; reflect damage back to attackers. |
| 🔋 Reactor, 🦠 Nanites, 🔰 Aegis | Granted by power cards: +energy each turn, poison all enemies each turn, gain Shield each turn. |

## Architecture

```
src/
  engine/            pure, deterministic rules (no React), fully unit-tested
    types.ts         cards, units, statuses, relics, events, run state
    rng.ts           seeded mulberry32 RNG (its state is stored inside game state)
    status.ts        status definitions = data + hooks
    cards.ts         card stats/upgrades, targeting, generated rules text
    combat.ts        combat reducer + turn pipeline + event log
    run.ts           map generation, rewards, rest/treasure, run reducer
    data/            cards (29), enemies (6 normal, 2 elite, 1 boss), relics (11)
  state/useGame.ts   useReducer over the run, plus localStorage autosave
  audio/             procedural WAV synth -> Howler.js (no binary assets)
  ui/                React screens and components
```

**Engine as a pure reducer.** `combatReducer(state, action)` clones the state, applies the action through a `CombatApi`, and returns the new state. Each rule mutation (damage, block, status, draw, energy) goes through that API, which emits a typed `CombatEvent`. The UI never inspects rule internals. It renders the state and plays animations and sounds from the event log: floating numbers, hit shakes, sounds and intent lunges are all driven by events.

**Turn pipeline.** Each turn runs in this order:
1. *Player turn start:* Block resets, status hooks run (`onTurnStart`), energy refills, relic hooks run (`onTurnStart`), then the player draws 5 cards (fewer if stunned).
2. *Card play:* check cost and target, spend energy, resolve effects, send the card to discard or exhaust, then run relic hooks (`onCardPlayed`).
3. *Player turn end:* status hooks run (`onTurnEnd`) and the hand is discarded.
4. *Enemy turn start:* each enemy's Block resets and its status hooks run (`onTurnStart`).
5. *Enemy actions:* `enemyStep` runs one enemy at a time, so the UI can animate each action. The enemy skips its action if stunned, otherwise resolves its intent; then its status hooks run (`onTurnEnd`) and it rolls its next intent.

The game checks for victory or defeat after every damage event.

**Modularity.**
- A new status is one entry in `status.ts`, with optional `onTurnStart`, `onTurnEnd`, `modifyOutgoing` and `modifyIncoming` hooks.
- A new relic is one entry in `data/relics.ts`. Available hooks are `onCombatStart`, `onTurnStart`, `onCardPlayed`, `onEnemyDeath`, `onStatusGained`, `modifyCost`, `modifyStatusApply` and `onCombatWon`.
- Cards and enemy intents share one `Effect` type and one resolver, so enemies can use any effect that cards can.

**Animation.** The hand has three animation layers:
- The outer layer handles the fan layout, the draw-in from the draw pile and the exit animation. The exit flies the card to the discard pile at end of turn, or dissolves it when played.
- The middle layer handles dragging. On release, the drop point is hit-tested against registered drop zones (enemies and the battlefield). An invalid drop springs the card back.
- The inner layer handles hover lift.

## Synergies to try

- **Poison:** Inject / Venom Spike → Catalyst → Payload Detonate, plus the *Toxin Daemon* relic or Nanite Swarm.
- **Shield wall:** Barrier Matrix + Aegis Protocol + *Firewall Core*, then Feedback Loop with Mirror Shell.
- **Overdrive burst:** Overclock + *Overclock Chip* + Adaptive AI into Zero Day or Overload Beam.
