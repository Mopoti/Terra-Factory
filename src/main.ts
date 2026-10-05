import { initLocale, t } from './i18n';
import { startBackdrop } from './render/backdrop';
import { ProvisionalSaveIndex } from './core/save/saveIndex';
import { mountMenu } from './ui/menu';

initLocale();
document.title = t('game.title');

startBackdrop(document.getElementById('app') as HTMLElement);

const devMode = new URLSearchParams(window.location.search).has('dev');
mountMenu(document.getElementById('ui') as HTMLElement, new ProvisionalSaveIndex(), devMode);
