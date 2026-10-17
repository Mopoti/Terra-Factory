/**
 * Écran de personnalisation du personnage (depuis l'accueil) : le personnage tourne au centre, les réglages sont
 * sur le côté, par onglets (Corps, Visage, Cheveux, Tenue). Le profil est enregistré avec « Valider ».
 */
import * as THREE from 'three';
import {
  BODY_KEYS,
  HAIR_STYLES,
  PALETTES,
  SILHOUETTES,
  defaultAppearance,
  randomAppearance,
  type Appearance,
  type BodyKey,
  type ColorKey,
} from '../core/profile/appearance';
import {
  getCharacter,
  getPseudo,
  PSEUDO_MAX,
  setCharacter,
  setPseudo,
} from '../core/profile/store';
import { Avatar, avatarFaceKeys, avatarReady, loadAvatar } from '../render/avatarModel';
import { t, type TranslationKey } from '../i18n';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const TABS = ['body', 'face', 'hair', 'outfit'] as const;
type Tab = (typeof TABS)[number];
let lastTab: Tab = 'body';

const percent = (v: number): string => `${v > 0 ? '+' : ''}${Math.round(v * 100)} %`;

export interface CharacterScreen {
  element: HTMLElement;
  dispose(): void;
}

export function buildCharacterScreen(back: () => void): CharacterScreen {
  let draft: Appearance = structuredClone(getCharacter());
  let disposed = false;
  let avatar: Avatar | null = null;
  const syncs: (() => void)[] = [];

  const panel = el('div', 'panel wide character');
  panel.append(el('h2', undefined, t('char.title')));
  const layout = el('div', 'char-layout');
  const stage = el('div', 'char-stage');
  const canvas = el('canvas', 'char-canvas');
  const loading = el('div', 'char-loading', t('char.loading'));
  stage.append(canvas, loading, el('small', 'help', t('char.dragHint')));
  const side = el('div', 'char-side');
  layout.append(stage, side);
  panel.append(layout);

  // --- Aperçu 3D ---------------------------------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6672, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(28, 360 / 520, 0.1, 50);
  camera.position.set(0, 0.1, 4.6);
  camera.lookAt(0, 0, 0);
  const turntable = new THREE.Group();
  scene.add(turntable);
  let spin = 0;
  let dragging = false;
  let resumeAt = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    spin += e.movementX * 0.012;
  });
  const release = (): void => {
    dragging = false;
    resumeAt = performance.now() + 2500;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function rebuildAvatar(): void {
    if (avatar) turntable.remove(avatar.root);
    if (!avatarReady()) return;
    avatar = new Avatar(1.7, 0xffffff, { appearance: draft });
    turntable.add(avatar.root);
  }
  function refresh(): void {
    avatar?.look(draft);
  }
  void loadAvatar().then((ok) => {
    if (disposed) return;
    loading.textContent = ok ? '' : t('char.unavailable');
    loading.hidden = ok;
    rebuildAvatar();
  });

  let last = performance.now();
  let raf = 0;
  const frame = (now: number): void => {
    if (disposed) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!dragging && now > resumeAt) spin += dt * 0.6;
    turntable.rotation.y = spin;
    avatar?.update(dt, 0, false);
    const w = canvas.clientWidth || 360;
    const h = canvas.clientHeight || 520;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // --- Commandes ---------------------------------------------------------------------------------
  function slider(label: string, get: () => number, set: (v: number) => void): HTMLElement {
    const row = el('div', 'char-row');
    row.append(el('span', 'char-label', label));
    const input = el('input');
    input.type = 'range';
    input.min = '-1';
    input.max = '1';
    input.step = '0.05';
    input.setAttribute('aria-label', label);
    const value = el('span', 'char-value');
    const sync = (): void => {
      input.value = String(get());
      value.textContent = percent(get());
    };
    input.addEventListener('input', () => {
      set(Math.round(Number(input.value) * 100) / 100);
      sync();
      refresh();
    });
    syncs.push(sync);
    sync();
    row.append(input, value);
    return row;
  }

  function colors(key: ColorKey, label: string): HTMLElement {
    const box = el('div', 'char-colors');
    box.append(el('span', 'char-label', label));
    const swatches = el('div', 'char-swatches');
    const buttons: HTMLButtonElement[] = [];
    for (const hex of PALETTES[key]) {
      const b = el('button', 'char-swatch');
      b.type = 'button';
      b.style.background = hex;
      b.title = hex;
      b.setAttribute('aria-label', `${label} ${hex}`);
      b.addEventListener('click', () => {
        draft.colors[key] = hex;
        sync();
        refresh();
      });
      buttons.push(b);
      swatches.append(b);
    }
    const free = el('input', 'char-free');
    free.type = 'color';
    free.setAttribute('aria-label', `${label} (${t('char.custom')})`);
    free.addEventListener('input', () => {
      draft.colors[key] = free.value;
      sync();
      refresh();
    });
    swatches.append(free);
    const sync = (): void => {
      free.value = draft.colors[key];
      buttons.forEach((b, i) =>
        b.setAttribute('aria-pressed', String(PALETTES[key][i] === draft.colors[key])),
      );
    };
    syncs.push(sync);
    sync();
    box.append(swatches);
    return box;
  }

  function choice<T extends string>(
    label: string,
    options: readonly T[],
    text: (v: T) => string,
    get: () => T,
    set: (v: T) => void,
  ): HTMLElement {
    const box = el('div', 'char-row');
    box.append(el('span', 'char-label', label));
    // Beaucoup de choix (les coupes de cheveux) : en grille sur plusieurs lignes.
    const seg = el('div', options.length > 4 ? 'ng-segment char-grid' : 'ng-segment');
    const buttons = new Map<T, HTMLButtonElement>();
    for (const o of options) {
      const b = el('button', undefined, text(o));
      b.type = 'button';
      b.addEventListener('click', () => {
        set(o);
        sync();
      });
      buttons.set(o, b);
      seg.append(b);
    }
    const sync = (): void => {
      for (const [o, b] of buttons) b.setAttribute('aria-pressed', String(get() === o));
    };
    syncs.push(sync);
    sync();
    box.append(seg);
    return box;
  }

  const panes = new Map<Tab, HTMLElement>();
  const tabButtons = new Map<Tab, HTMLButtonElement>();
  const pseudoField = el('label', 'field char-pseudo');
  pseudoField.append(el('span', undefined, t('char.pseudo')));
  const pseudoInput = el('input');
  pseudoInput.type = 'text';
  pseudoInput.maxLength = PSEUDO_MAX;
  pseudoInput.value = getPseudo();
  pseudoInput.placeholder = t('join.defaultName');
  pseudoField.append(pseudoInput);
  const tablist = el('div', 'ng-tabs');
  tablist.setAttribute('role', 'tablist');
  const showTab = (tab: Tab): void => {
    lastTab = tab;
    for (const id of TABS) {
      tabButtons.get(id)?.setAttribute('aria-selected', String(id === tab));
      const pane = panes.get(id);
      if (pane) pane.hidden = id !== tab;
    }
  };
  for (const id of TABS) {
    const b = el('button', 'ng-tab', t(`char.tab.${id}` as TranslationKey));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => showTab(id));
    tabButtons.set(id, b);
    tablist.append(b);
    const pane = el('div', 'ng-pane');
    pane.setAttribute('role', 'tabpanel');
    panes.set(id, pane);
  }
  side.append(pseudoField, tablist, ...TABS.map((id) => panes.get(id) as HTMLElement));

  // Corps.
  const body = panes.get('body') as HTMLElement;
  body.append(
    choice(
      t('char.silhouette'),
      SILHOUETTES,
      (s) => t(`char.silhouette.${s}` as TranslationKey),
      () => draft.silhouette,
      (s) => {
        draft.silhouette = s;
        rebuildAvatar();
      },
    ),
  );
  for (const key of BODY_KEYS as readonly BodyKey[])
    body.append(
      slider(
        t(`char.body.${key}` as TranslationKey),
        () => draft.body[key],
        (v) => (draft.body[key] = v),
      ),
    );
  body.append(colors('skin', t('char.color.skin')));

  // Visage : seulement les réglages que le modèle chargé sait appliquer.
  const face = panes.get('face') as HTMLElement;
  const faceHolder = el('div', 'char-face');
  face.append(faceHolder);
  const buildFace = (): void => {
    faceHolder.replaceChildren();
    const keys = avatarFaceKeys();
    if (keys.length === 0) faceHolder.append(el('p', 'help', t('char.face.soon')));
    for (const key of keys)
      faceHolder.append(
        slider(
          t(`char.face.${key}` as TranslationKey),
          () => draft.face[key],
          (v) => (draft.face[key] = v),
        ),
      );
    faceHolder.append(colors('eyes', t('char.color.eyes')));
  };
  buildFace();
  void loadAvatar().then(() => !disposed && buildFace());

  // Cheveux.
  const hair = panes.get('hair') as HTMLElement;
  hair.append(
    choice(
      t('char.hair.style'),
      HAIR_STYLES,
      (h) => t(`char.hair.${h}` as TranslationKey),
      () => draft.hairStyle,
      (h) => {
        draft.hairStyle = h;
        refresh();
      },
    ),
    colors('hair', t('char.color.hair')),
  );

  // Tenue.
  const outfit = panes.get('outfit') as HTMLElement;
  outfit.append(colors('suit', t('char.color.suit')), colors('stripe', t('char.color.stripe')));
  showTab(lastTab);

  // --- Boutons -------------------------------------------------------------------------------------
  const resync = (): void => {
    syncs.forEach((s) => s());
    rebuildAvatar();
  };
  const actions = el('div', 'char-actions');
  const button = (label: string, onClick: () => void, cls = 'menu-btn'): HTMLButtonElement => {
    const b = el('button', cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  };
  actions.append(
    button(t('char.random'), () => {
      draft = randomAppearance();
      resync();
    }),
    button(t('char.reset'), () => {
      draft = defaultAppearance();
      resync();
    }),
    button(
      t('char.validate'),
      () => {
        setCharacter(draft);
        setPseudo(pseudoInput.value);
        back();
      },
      'menu-btn primary',
    ),
    button(t('common.back'), back),
  );
  side.append(actions);

  function dispose(): void {
    disposed = true;
    cancelAnimationFrame(raf);
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return { element: panel, dispose };
}
