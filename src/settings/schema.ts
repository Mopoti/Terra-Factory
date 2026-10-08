import type { UnitPrefs } from '../core/units';
import { defaultControls, type ControlsSettings, type KeyboardPreset } from './controls';

export type Quality = 'low' | 'medium' | 'high';
export type ShadowQuality = 'off' | 'normal' | 'detailed';
export type TimeFormat = 'auto' | '24h' | '12h';
export type ColorBlindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
export type Shoulder = 'left' | 'center' | 'right';
export type CrosshairStyle = 'cross' | 'dot' | 'circle' | 'none';
export type CrosshairColor = 'white' | 'orange' | 'green' | 'red' | 'cyan';
export type TopRotation = 'free' | 'step' | 'locked';

export interface Settings {
  display: {
    gamma: number;
    brightness: number;
    viewDistance: number;
    quality: Quality;
    shadows: ShadowQuality;
    /** Images par seconde maximum ; 0 = illimité. */
    fpsLimit: number;
    uiScale: number;
    timeFormat: TimeFormat;
    colorblind: ColorBlindMode;
    showFps: boolean;
    /** Barre de santé toujours affichée (sinon la rougeur de l'écran indique les dégâts). */
    showHealth: boolean;
    units: UnitPrefs;
  };
  sound: {
    master: number;
    music: number;
    ambience: number;
    interaction: number;
    machines: number;
    alerts: number;
    mute: {
      master: boolean;
      music: boolean;
      ambience: boolean;
      interaction: boolean;
      machines: boolean;
      alerts: boolean;
    };
    muteInBackground: boolean;
  };
  views: {
    common: { mouseSensitivity: number; invertY: boolean; smoothing: number };
    first: {
      fov: number;
      headBob: boolean;
      headBobIntensity: number;
      tilt: boolean;
      showHands: boolean;
      crosshairStyle: CrosshairStyle;
      crosshairSize: number;
      crosshairColor: CrosshairColor;
    };
    third: {
      fov: number;
      distance: number;
      height: number;
      shoulder: Shoulder;
      collision: boolean;
      autoRotate: boolean;
      ghost: boolean;
      ghostRadius: number;
    };
    top: {
      angle: number;
      zoomMin: number;
      zoomMax: number;
      zoomSpeed: number;
      rotation: TopRotation;
      edgeScroll: boolean;
      autoHideFloors: boolean;
      ghost: boolean;
      ghostRadius: number;
    };
  };
  /** Type de clavier choisi : détermine ZQSD ou WASD et la lecture des lettres des touches. */
  keyboard: KeyboardPreset;
  controls: ControlsSettings;
  game: {
    /** Minutes entre deux sauvegardes automatiques ; 0 = désactivée. */
    autosaveMinutes: number;
    autosaveKeep: number;
    showTips: boolean;
    confirmDelete: boolean;
    /** Taille des commandes tactiles (%). */
    touchScale: number;
    /** Commandes tactiles inversées (joystick à droite, boutons à gauche). */
    touchLeftHanded: boolean;
    /** Vitesse du regard à la manette (%) et zone morte des sticks (%). */
    padSensitivity: number;
    padDeadzone: number;
  };
}

export type SectionName = 'display' | 'sound' | 'views' | 'controls' | 'game';

/** Valeurs par défaut pour un type de clavier (ZQSD ou WASD). */
export function defaultSettings(preset: KeyboardPreset): Settings {
  return {
    display: {
      gamma: 1,
      brightness: 100,
      viewDistance: 8,
      quality: 'medium',
      shadows: 'normal',
      fpsLimit: 60,
      uiScale: 100,
      timeFormat: 'auto',
      colorblind: 'none',
      showFps: false,
      showHealth: false,
      units: { distance: 'm', temperature: 'C', mass: 'kg', pressure: 'Pa', energy: 'SI' },
    },
    sound: {
      master: 80,
      music: 50,
      ambience: 70,
      interaction: 80,
      machines: 70,
      alerts: 80,
      mute: {
        master: false,
        music: false,
        ambience: false,
        interaction: false,
        machines: false,
        alerts: false,
      },
      muteInBackground: true,
    },
    views: {
      common: { mouseSensitivity: 50, invertY: false, smoothing: 30 },
      first: {
        fov: 90,
        headBob: true,
        headBobIntensity: 50,
        tilt: true,
        showHands: true,
        crosshairStyle: 'cross',
        crosshairSize: 50,
        crosshairColor: 'white',
      },
      third: {
        fov: 70,
        distance: 4,
        height: 1.8,
        shoulder: 'right',
        collision: true,
        autoRotate: false,
        ghost: true,
        ghostRadius: 50,
      },
      top: {
        angle: 60,
        zoomMin: 4,
        zoomMax: 40,
        zoomSpeed: 50,
        rotation: 'free',
        edgeScroll: false,
        autoHideFloors: true,
        ghost: true,
        ghostRadius: 50,
      },
    },
    keyboard: preset,
    controls: defaultControls(preset),
    game: {
      autosaveMinutes: 10,
      autosaveKeep: 5,
      showTips: true,
      confirmDelete: true,
      touchScale: 100,
      touchLeftHanded: false,
      padSensitivity: 100,
      padDeadzone: 20,
    },
  };
}
