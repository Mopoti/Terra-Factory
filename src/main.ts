import { initLocale, t } from './i18n';
import { startGameView } from './render/gameView';
import { ProvisionalSaveIndex, type GameSummary } from './core/save/saveIndex';
import { mountMenu } from './ui/menu';
import { mountMenuBackground } from './ui/menuBackground';

initLocale();
document.title = t('game.title');

const appEl = document.getElementById('app') as HTMLElement;
const uiEl = document.getElementById('ui') as HTMLElement;
const bgEl = document.getElementById('menu-bg') as HTMLElement;
const hudEl = document.getElementById('hud') as HTMLElement;

const saves = new ProvisionalSaveIndex();
const devMode = new URLSearchParams(window.location.search).has('dev');

const resetMenu = mountMenu(uiEl, { saves, devMode, onStartGame: startGame });

let stopBackground: () => void = () => undefined;
let stopGame: (() => void) | null = null;

function showMenu(): void {
  stopGame?.();
  stopGame = null;
  hudEl.replaceChildren();
  bgEl.hidden = false;
  uiEl.hidden = false;
  void mountMenuBackground(bgEl).then((stop) => (stopBackground = stop));
  resetMenu();
}

function startGame(game: GameSummary): void {
  stopBackground();
  bgEl.hidden = true;
  uiEl.hidden = true;
  stopGame = startGameView(appEl);

  const label = document.createElement('div');
  label.className = 'game-hud';
  const name = document.createElement('span');
  name.textContent = t('game.hud.playing', { name: game.name });
  const back = document.createElement('button');
  back.type = 'button';
  back.textContent = t('game.hud.menu');
  back.addEventListener('click', showMenu);
  label.append(name, back);
  hudEl.replaceChildren(label);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stopGame) showMenu();
});

showMenu();
