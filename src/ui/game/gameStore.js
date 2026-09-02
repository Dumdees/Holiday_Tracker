// Holds the running game in a signal and saves it in the browser, separately from the holiday records.
import { signal } from '@preact/signals';
import { newGame, loadGame, serialise } from '../../core/game/engine.js';

const KEY = 'mhm:game';
export const game = signal(null);
export const offlineReport = signal(null);
let saveTimer = null;

function readSave() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

/** Load (or start) the game. Safe to call more than once. */
export function startGame(now = Date.now()) {
  if (game.value) return game.value;
  const { state, offline } = loadGame(readSave(), now);
  game.value = state;
  offlineReport.value = offline;
  return state;
}

export function saveGame() {
  const s = game.value;
  if (!s) return;
  try { localStorage.setItem(KEY, JSON.stringify(serialise(s))); } catch { /* storage full or blocked – the game still plays */ }
}

export function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveGame(); }, 4000);
}

/** Change the game state through `fn(state)`; the view re-renders. Returns fn's result. */
export function mutate(fn) {
  const s = game.value;
  if (!s) return undefined;
  const result = fn(s);
  game.value = { ...s };
  return result;
}

export function resetGame(now = Date.now()) {
  game.value = newGame(now);
  offlineReport.value = null;
  saveGame();
}

export function hasSavedGame() {
  return !!readSave();
}
