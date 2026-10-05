import { watchVisibility } from './audio/audio';
import {
  DEFAULT_PLAYER_STATE,
  ProvisionalSaveIndex,
  type GameSummary,
  type PlayerState,
  type SaveSlot,
} from './core/save/saveIndex';
import { initLocale, t } from './i18n';
import { startGameView, type GameViewHandle } from './render/gameView';
import { initKeyboardLayout } from './settings/controls';
import { startApplyingSettings } from './settings/apply';
import { getSettings, loadSettings } from './settings/store';
import { mountMenu } from './ui/menu';
import { mountMenuBackground } from './ui/menuBackground';
import { mountPauseMenu, type PauseMenu } from './ui/pauseMenu';

initLocale();
await initKeyboardLayout();
loadSettings();
startApplyingSettings();
watchVisibility();
document.title = t('game.title');

const appEl = document.getElementById('app') as HTMLElement;
const uiEl = document.getElementById('ui') as HTMLElement;
const bgEl = document.getElementById('menu-bg') as HTMLElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const pauseEl = document.getElementById('pause') as HTMLElement;

const saves = new ProvisionalSaveIndex();
const params = new URLSearchParams(window.location.search);
const devMode = params.has('dev');

interface Session {
  game: GameSummary;
  view: GameViewHandle;
  pause: PauseMenu;
  /** Dernier nom de sauvegarde manuelle utilisé pendant cette session. */
  lastManualName: string | null;
  lastAutosaveAt: number;
  timer: number;
  toastTimer: number;
}

const resetMenu = mountMenu(uiEl, { saves, devMode, onStartGame: startGame });
let stopBackground: () => void = () => undefined;
let session: Session | null = null;

function showToast(text: string): void {
  hudEl.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = text;
  hudEl.append(toast);
  if (session) {
    window.clearTimeout(session.toastTimer);
    session.toastTimer = window.setTimeout(() => toast.remove(), 2500);
  }
}

function saveAuto(s: Session): void {
  const result = saves.saveSlot(
    s.game.id,
    { name: t('save.autoName'), kind: 'auto', player: s.view.getState() },
    getSettings().game.autosaveKeep,
  );
  if (result) s.game = result.game;
  s.lastAutosaveAt = Date.now();
}

function showMenu(): void {
  hudEl.replaceChildren();
  bgEl.hidden = false;
  uiEl.hidden = false;
  void mountMenuBackground(bgEl).then((stop) => (stopBackground = stop));
  resetMenu();
}

/** Quitte la partie vers le menu principal ; une sauvegarde automatique est faite avant. */
function quitToMenu(): void {
  const s = session;
  if (!s) return;
  saveAuto(s);
  window.clearInterval(s.timer);
  window.clearTimeout(s.toastTimer);
  s.pause.dispose();
  s.view.dispose();
  session = null;
  showMenu();
}

function startGame(game: GameSummary, slot?: SaveSlot): void {
  stopBackground();
  bgEl.hidden = true;
  uiEl.hidden = true;

  const at = params.get('at')?.split(',').map(Number);
  const devStart: Partial<PlayerState> | undefined =
    devMode && !slot && at && at.length === 2 && at.every(Number.isFinite)
      ? { x: at[0], z: at[1], distance: Number(params.get('dist')) || undefined }
      : undefined;
  const start = slot?.player ?? devStart ?? DEFAULT_PLAYER_STATE;

  const view = startGameView(appEl, game, { start });
  const s: Session = {
    game,
    view,
    pause: null as unknown as PauseMenu,
    lastManualName: slot?.kind === 'manual' ? slot.name : null,
    lastAutosaveAt: Date.now(),
    timer: 0,
    toastTimer: 0,
  };
  session = s;

  s.pause = mountPauseMenu(pauseEl, {
    onPausedChange: (paused) => view.setPaused(paused),
    defaultSaveName: () =>
      s.lastManualName ??
      [...s.game.saves].filter((x) => x.kind === 'manual').sort((a, b) => b.savedAt - a.savedAt)[0]
        ?.name ??
      t('save.defaultName'),
    manualSaveNames: () => s.game.saves.filter((x) => x.kind === 'manual').map((x) => x.name),
    save: (name) => {
      const result = saves.saveSlot(s.game.id, { name, kind: 'manual', player: view.getState() });
      if (!result) return;
      s.game = result.game;
      s.lastManualName = name;
      showToast(t('pause.saved', { name }));
    },
    quit: quitToMenu,
  });

  const label = document.createElement('div');
  label.className = 'game-hud';
  const name = document.createElement('span');
  name.textContent = t('game.hud.playing', { name: game.name });
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.textContent = t('game.hud.menu');
  menuButton.addEventListener('click', () => s.pause.open());
  label.append(name, menuButton);
  hudEl.replaceChildren(label);

  // Sauvegarde automatique périodique (réglage « Jeu » ; 0 = désactivée).
  s.timer = window.setInterval(() => {
    const minutes = getSettings().game.autosaveMinutes;
    if (minutes > 0 && !s.pause.isOpen() && Date.now() - s.lastAutosaveAt >= minutes * 60_000) {
      saveAuto(s);
      showToast(t('pause.autosaved'));
    }
  }, 15_000);
}

showMenu();
