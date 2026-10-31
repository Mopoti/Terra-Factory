import { watchVisibility } from './audio/audio';
import {
  DEFAULT_PLAYER_STATE,
  type GameSummary,
  type PlayerState,
  type SaveSlot,
} from './core/save/saveIndex';
import { GameState } from './core/game/state';
import { encodeLook } from './core/profile/appearance';
import { getCharacter, getPseudo, loadCharacter } from './core/profile/store';
import { SaveLibrary } from './core/save/library';
import { LocalStorageStorage, openBestStorage } from './core/save/storage';
import { getLocale, initLocale, t, type TranslationKey } from './i18n';
import { startGameView, type GameViewHandle } from './render/gameView';
import { initKeyboardLayout } from './settings/controls';
import { startApplyingSettings } from './settings/apply';
import { getSettings, loadSettings } from './settings/store';
import { CELL_SIZE_M } from './core/constants';
import { compassOf } from './core/game/weather';
import { formatTemperature } from './core/units';
import { mountHotbar, type Hotbar } from './ui/hotbar';
import { mountMachineWindow, type MachineWindow } from './ui/machineWindow';
import { mountInventory, type InventoryWindow } from './ui/inventory';
import { mountMap, type MapWindow } from './ui/mapView';
import { mountTech, type TechWindow } from './ui/techView';
import { mountMenu } from './ui/menu';
import { mountMenuBackground } from './ui/menuBackground';
import { mountPauseMenu, type PauseMenu } from './ui/pauseMenu';
import { mountMenuPad } from './input/gamepad';
import { mountArmorMenu, type ArmorMenu } from './ui/armorMenu';
import { mountChat, type Chat } from './ui/chat';
import { runChat } from './core/game/chatCommands';
import { installKeyHints } from './ui/keyHints';
import { PeerNetwork } from './net/peerNetwork';
import { HostSession } from './core/net/host';
import { GuestClient, RefusedError } from './core/net/guest';
import type { JoinInfo } from './ui/menu';
import { GuestSync } from './core/net/worldSync';
import { mergeChanges } from './core/game/playerData';
import type { WorldChanges } from './core/game/worldChanges';
import { choiceModal, promptModal } from './ui/modal';
import { GARAGE_RANGES } from './core/game/worldChanges';
import { STATION_NAME_MAX } from './core/rail/station';
import { buildBugReport, downloadBugReport, installBugRecorder, recorder } from './ui/bugReport';

initLocale();
installKeyHints();
await initKeyboardLayout();
loadSettings();
loadCharacter();
startApplyingSettings();
installBugRecorder();
watchVisibility();
document.title = t('game.title');

const appEl = document.getElementById('app') as HTMLElement;
const uiEl = document.getElementById('ui') as HTMLElement;
const bgEl = document.getElementById('menu-bg') as HTMLElement;
const hudEl = document.getElementById('hud') as HTMLElement;
const pauseEl = document.getElementById('pause') as HTMLElement;
const inventoryEl = document.getElementById('inventory') as HTMLElement;
const machineEl = document.getElementById('machine') as HTMLElement;
const mapEl = document.getElementById('map') as HTMLElement;
const techEl = document.getElementById('tech') as HTMLElement;
const armorEl = document.getElementById('armor') as HTMLElement;
const chatEl = document.getElementById('chat') as HTMLElement;

/** Stockage définitif (IndexedDB) ; les parties de l'ancien stockage navigateur y sont reprises une fois. */
const storage = await openBestStorage();
const saves = await SaveLibrary.open(
  storage,
  storage.kind === 'indexeddb' ? new LocalStorageStorage(localStorage) : null,
);
// Demande au navigateur de ne pas effacer les parties quand l'espace disque manque.
void navigator.storage?.persist?.().catch(() => undefined);
window.addEventListener('pagehide', () => void saves.flush());
const params = new URLSearchParams(window.location.search);
const devMode = params.has('dev');

interface Session {
  game: GameSummary;
  view: GameViewHandle;
  pause: PauseMenu;
  inventory: InventoryWindow;
  hotbar: Hotbar;
  machine: MachineWindow;
  map: MapWindow;
  tech: TechWindow;
  armor: ArmorMenu;
  chat: Chat;
  /** Sac et changements du monde de cette session. */
  state: GameState;
  /** Partie rejointe chez un autre joueur (aucune sauvegarde locale). */
  guest: { client: GuestClient; sync: GuestSync } | null;
  /** Fiches des joueurs invités retrouvées dans la sauvegarde (ou celles de l'hôte, quand il a fermé la partie). */
  savedPlayers: SaveSlot['players'];
  /** Dernier nom de sauvegarde manuelle utilisé pendant cette session. */
  lastManualName: string | null;
  lastAutosaveAt: number;
  timer: number;
  /** Position et état du joueur notés toutes les 2 s dans l'enregistreur d'actions. */
  sampler: number;
  toastTimer: number;
}

const network = new PeerNetwork();
const resetMenu = mountMenu(uiEl, {
  saves,
  devMode,
  onStartGame: startGame,
  network,
  onJoin: startGuest,
});
let stopBackground: () => void = () => undefined;
/** Manette dans les menus : active tant qu'aucune partie n'est ouverte. */
let stopMenuPad: () => void = () => undefined;
let session: Session | null = null;
/** Partie ouverte aux invités (multijoueur) : fermée quand on quitte la partie. */
let host: HostSession | null = null;
let hostCode: string | null = null;

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
  if (s.guest) return;
  const result = saves.saveSlot(
    s.game.id,
    {
      name: t('save.autoName'),
      kind: 'auto',
      player: s.view.getState(),
      players: host?.exportProfiles() ?? s.savedPlayers,
      ...s.state.snapshot(),
    },
    getSettings().game.autosaveKeep,
  );
  if (result) s.game = result.game;
  s.lastAutosaveAt = Date.now();
}

function showMenu(): void {
  stopMenuPad();
  stopMenuPad = mountMenuPad();
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
  window.clearInterval(s.sampler);
  window.clearTimeout(s.toastTimer);
  s.pause.dispose();
  s.inventory.dispose();
  s.map.dispose();
  s.tech.dispose();
  s.armor.dispose();
  s.chat.dispose();
  s.hotbar.dispose();
  s.machine.dispose();
  s.view.dispose();
  s.guest?.sync.dispose();
  s.guest?.client.leave();
  host?.close();
  host = null;
  hostCode = null;
  session = null;
  showMenu();
}

/** Rejoint la partie d'un autre joueur : le monde vient de l'hôte, rien n'est enregistré sur cet appareil. */
function startGuest(client: GuestClient, who: JoinInfo): void {
  const game: GameSummary = {
    id: `guest-${client.you.id}`,
    name: client.players[0]?.name ?? client.you.name,
    world: client.worldParams,
    options: client.options,
    createdAt: Date.now(),
    saves: [],
  };
  const state = new GameState({
    inventory: client.inventory,
    changes: mergeChanges(client.world as WorldChanges, client.changes),
  });
  state.playerKey = client.you.name;
  const sync = new GuestSync(client, state);
  sync.onLost(() => void reconnect(sync, who));
  startGame(game, undefined, { client, sync }, state);
}

/** Liaison coupée : on retente de rejoindre la même partie sous le même nom (l'hôte rend sa fiche). */
async function reconnect(sync: GuestSync, who: JoinInfo): Promise<void> {
  for (let i = 0; i < 10; i++) {
    showToast(t('join.reconnecting'));
    await new Promise((r) => window.setTimeout(r, 3000));
    if (session?.guest?.sync !== sync) return; // le joueur a quitté entre-temps
    try {
      sync.rebind(await GuestClient.connect(network, who.code, who));
      showToast(t('join.reconnected'));
      return;
    } catch (e) {
      if (e instanceof RefusedError && e.reason !== 'closed-link') break; // refus net : inutile d'insister
    }
  }
  showToast(t('join.lost'));
  quitToMenu();
}

function startGame(
  game: GameSummary,
  slot?: SaveSlot,
  guest: { client: GuestClient; sync: GuestSync } | null = null,
  guestState?: GameState,
): void {
  stopBackground();
  stopMenuPad();
  bgEl.hidden = true;
  uiEl.hidden = true;

  const at = params.get('at')?.split(',').map(Number);
  const devStart: Partial<PlayerState> | undefined =
    devMode && !slot && at && at.length === 2 && at.every(Number.isFinite)
      ? { x: at[0], z: at[1], distance: Number(params.get('dist')) || undefined }
      : undefined;
  const start = slot?.player ?? devStart ?? DEFAULT_PLAYER_STATE;

  const state = guestState ?? new GameState(slot);
  state.creative = (state.changes.modeOverride ?? game.options.mode) === 'creative';
  state.costs = game.options.difficulty;
  const view = startGameView(appEl, game, {
    state,
    start,
    guest: guest?.sync,
    onToggleInventory: () => {
      if (!session?.pause.isOpen() && !session?.map.isOpen() && !session?.tech.isOpen()) {
        // Au volant du buggy, l'inventaire est celui du buggy (carburant et objets).
        const driving = session?.view.mountedMachineId() ?? null;
        if (session?.machine.isOpen()) session.machine.close();
        else if (driving !== null && !session?.inventory.isOpen()) session?.machine.open(driving);
        else session?.inventory.toggle();
      }
    },
    onDebugChange: (on) => {
      hudEl.querySelector('.game-hud')?.toggleAttribute('hidden', !on);
    },
    onToggleMap: () => {
      if (
        !session?.pause.isOpen() &&
        !session?.inventory.isOpen() &&
        !session?.machine.isOpen() &&
        !session?.tech.isOpen()
      )
        session?.map.toggle();
    },
    onToggleArmor: () => {
      if (
        !session?.pause.isOpen() &&
        !session?.inventory.isOpen() &&
        !session?.machine.isOpen() &&
        !session?.map.isOpen() &&
        !session?.tech.isOpen()
      )
        session?.armor.toggle();
    },
    onToggleChat: () => {
      if (
        !session?.pause.isOpen() &&
        !session?.inventory.isOpen() &&
        !session?.machine.isOpen() &&
        !session?.map.isOpen() &&
        !session?.tech.isOpen() &&
        !session?.armor.isOpen()
      )
        session?.chat.toggle();
    },
    onToggleTech: () => {
      if (
        !session?.pause.isOpen() &&
        !session?.inventory.isOpen() &&
        !session?.machine.isOpen() &&
        !session?.map.isOpen()
      )
        session?.tech.toggle();
    },
    onMessage: (text) => showToast(text),
    onViewChange: (v) => showToast(t('view.changed', { view: t(`view.${v}` as TranslationKey) })),
    onRequestPause: () => session?.pause.open(),
    onRenameStation: (id) => {
      void renameStation(id);
    },
    onChooseStation: async (stations) => {
      view.setUiOpen(true);
      const id = await choiceModal({
        title: t('station.route.title'),
        choices: stations.map((st) => ({ value: st.id, label: st.name })),
        cancelLabel: t('station.cancel'),
      });
      syncPaused();
      return id;
    },
    onConfigureGarage: async (current) => {
      view.setUiOpen(true);
      try {
        const mode = await choiceModal({
          title: t('garage.title'),
          choices: [
            { value: 0, label: t('garage.manual') },
            { value: 1, label: t('garage.auto') },
          ],
          cancelLabel: t('station.cancel'),
        });
        if (mode === null) return null;
        if (mode === 0) return { mode: 'manual', range: current.range };
        const range = await choiceModal({
          title: t('garage.range'),
          choices: GARAGE_RANGES.map((n) => ({
            value: n,
            label: t('garage.rangeChoice', { n: String(n) }),
          })),
          cancelLabel: t('station.cancel'),
        });
        return range === null ? null : { mode: 'auto', range };
      } finally {
        syncPaused();
      }
    },
    onOpenMachine: (id) => {
      if (!session?.pause.isOpen() && !session?.inventory.isOpen()) session?.machine.open(id);
    },
  });
  const s: Session = {
    game,
    view,
    pause: null as unknown as PauseMenu,
    inventory: null as unknown as InventoryWindow,
    hotbar: mountHotbar(document.body, state, { onMessage: (text) => showToast(text) }),
    machine: null as unknown as MachineWindow,
    map: null as unknown as MapWindow,
    tech: null as unknown as TechWindow,
    armor: null as unknown as ArmorMenu,
    chat: null as unknown as Chat,
    state,
    guest,
    savedPlayers: slot?.players,
    lastManualName: slot?.kind === 'manual' ? slot.name : null,
    lastAutosaveAt: Date.now(),
    timer: 0,
    sampler: 0,
    toastTimer: 0,
  };
  session = s;
  (window as unknown as { __s: unknown }).__s = s;

  /** Renomme une station : fenêtre de saisie, le jeu continue derrière. */
  const renameStation = async (id: number): Promise<void> => {
    const st = state.changes.stations.find((x) => x.id === id);
    if (!st) return;
    view.setUiOpen(true);
    const name = await promptModal({
      title: t('station.rename.title'),
      label: t('station.rename.label'),
      value: st.name,
      confirmLabel: t('station.confirm'),
      cancelLabel: t('station.cancel'),
      maxLength: STATION_NAME_MAX,
      validate: (v) => (v === '' ? t('manage.nameEmpty') : null),
    });
    syncPaused();
    if (name !== null) state.renameStation(id, name);
  };

  /** Le jeu n'est figé que par le menu pause. */
  const syncPaused = (): void => {
    // Seul le menu pause (Échap) fige le jeu. Sac, machine, carte et technologies laissent l'usine tourner
    // et le joueur marcher : la souris est libre pour s'en servir.
    view.setPaused(s.pause.isOpen());
    view.setUiOpen(
      s.inventory.isOpen() ||
        s.machine.isOpen() ||
        s.map.isOpen() ||
        s.tech.isOpen() ||
        s.armor.isOpen(),
    );
    view.setOpenedMachine(s.machine.isOpen() ? s.machine.openedId() : null);
  };

  s.machine = mountMachineWindow(machineEl, state, view.factory, {
    bus: view.bus,
    onOpenChange: syncPaused,
    resolve: (id) => view.vehicleMachine(id),
    reading: (m) => {
      const w = view.weatherAt((m.gx + 0.5) * CELL_SIZE_M, (m.gz + 0.5) * CELL_SIZE_M);
      if (m.type === 'thermometer')
        return t('machine.thermometer.reading', {
          temp: formatTemperature(w.tempC, getSettings().display.units, getLocale()),
        });
      if (m.type === 'vane')
        return t('machine.vane.reading', {
          speed: String(Math.round(w.wind.speed * 60)),
          dir: t(`compass.${compassOf(w.wind.dir)}` as TranslationKey),
        });
      return null;
    },
  });
  s.tech = mountTech(techEl, state, { onOpenChange: syncPaused, bus: view.bus });
  s.chat = mountChat(chatEl, {
    onOpenChange: syncPaused,
    onSubmit: (line) =>
      guest
        ? { ok: false, text: t('chat.guest') }
        : runChat(line, { state, time: game.options.time }),
  });
  s.armor = mountArmorMenu(armorEl, state, {
    onOpenChange: syncPaused,
    onMessage: (text) => showToast(text),
  });
  s.map = mountMap(mapEl, {
    world: game.world,
    state,
    factory: view.factory,
    threat: view.threat,
    player: () => {
      const p = view.getState();
      return { x: p.x, z: p.z, yaw: view.bodyYaw() };
    },
    others: () => view.otherPlayers(),
    onOpenChange: syncPaused,
  });
  s.inventory = mountInventory(inventoryEl, state, {
    bus: view.bus,
    drop: (item, count) => view.dropItem(item, count),
    onOpenChange: syncPaused,
  });
  s.pause = mountPauseMenu(pauseEl, {
    onPausedChange: syncPaused,
    defaultSaveName: () =>
      s.lastManualName ??
      [...s.game.saves].filter((x) => x.kind === 'manual').sort((a, b) => b.savedAt - a.savedAt)[0]
        ?.name ??
      t('save.defaultName'),
    manualSaveNames: () => s.game.saves.filter((x) => x.kind === 'manual').map((x) => x.name),
    save: (name) => {
      const result = saves.saveSlot(s.game.id, {
        name,
        kind: 'manual',
        player: view.getState(),
        players: host?.exportProfiles() ?? s.savedPlayers,
        ...s.state.snapshot(),
      });
      if (!result) return;
      s.game = result.game;
      s.lastManualName = name;
      showToast(t('pause.saved', { name }));
    },
    report: (note) => {
      const report = buildBugReport({
        note,
        game: { id: game.id, name: game.name, seed: game.world.seed },
        snapshot: s.state.snapshot(),
        player: view.getState(),
        info: view.debugInfo(),
        settings: getSettings(),
        screenshot: view.captureFrame(),
      });
      return downloadBugReport(report);
    },
    guest: guest !== null,
    multi:
      game.options.multiplayer.enabled && !guest
        ? {
            code: () => hostCode,
            players: () => host?.players().map((p) => p.name) ?? [],
            start: async () => {
              host = new HostSession({
                state,
                factory: view.factory,
                blockedFor: view.blockedFor,
                threat: view.threat,
                world: game.world,
                options: game.options,
                hostName: getPseudo() || t('join.defaultName'),
                hostLook: encodeLook(getCharacter()),
                players: s.savedPlayers,
                approve: (name) => window.confirm(t('pause.multi.approve', { name })),
              });
              hostCode = await host.open(network);
              view.setHost(host);
              return hostCode;
            },
            stop: () => {
              view.setHost(null);
              host?.close();
              host = null;
              hostCode = null;
            },
          }
        : undefined,
    quit: quitToMenu,
  });

  const label = document.createElement('div');
  label.className = 'game-hud';
  label.hidden = true;
  const name = document.createElement('span');
  name.textContent = t('game.hud.playing', { name: game.name });
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.textContent = t('game.hud.menu');
  menuButton.addEventListener('click', () => s.pause.open());
  const bagButton = document.createElement('button');
  bagButton.type = 'button';
  bagButton.textContent = t('game.hud.bag');
  bagButton.addEventListener('click', () => !s.pause.isOpen() && s.inventory.open());
  label.append(name, bagButton, menuButton);
  hudEl.replaceChildren(label);

  // Rapport de bug : ce qui se passe dans le jeu est noté dans l'enregistreur (60 dernières secondes).
  recorder.clear();
  state.onChange((e) => recorder.record('event', e));
  view.bus.onDispatch = (cmd, result) => recorder.record('command', { cmd, result });
  s.sampler = window.setInterval(() => {
    recorder.record('sample', { player: view.getState(), info: view.debugInfo() });
  }, 2000);

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
