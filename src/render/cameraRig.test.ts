import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYER_STATE } from '../core/save/saveIndex';
import { defaultSettings, type Settings } from '../settings/schema';
import { CameraRig } from './cameraRig';

function setup(
  rotation: Settings['views']['top']['rotation'],
  view: 'first' | 'third' | 'top' = 'top',
) {
  const views = defaultSettings('zqsd').views;
  views.top.rotation = rotation;
  const rig = new CameraRig(new THREE.PerspectiveCamera(), {
    ...DEFAULT_PLAYER_STATE,
    view,
    yaw: 0,
  });
  return { rig, views };
}

describe('rotation de la caméra à la souris', () => {
  it('le défaut de la vue du dessus est la rotation libre', () => {
    expect(defaultSettings('zqsd').views.top.rotation).toBe('free');
  });
  it('vue du dessus, rotation libre : le clic droit maintenu fait tourner', () => {
    const { rig, views } = setup('free');
    rig.look(100, 0, views);
    expect(Math.abs(rig.getState().yaw)).toBeGreaterThan(0.1);
  });
  it('vue du dessus, par pas de 90° : on tourne pendant le glissé puis le cap s’aimante au relâchement', () => {
    const { rig, views } = setup('step');
    rig.look(120, 0, views);
    const during = rig.getState().yaw;
    expect(Math.abs(during)).toBeGreaterThan(0.1);
    expect(Math.abs(during % (Math.PI / 2))).toBeGreaterThan(0.01); // pas encore aimanté
    rig.endLook(views);
    const after = rig.getState().yaw;
    expect(Math.abs(after / (Math.PI / 2) - Math.round(after / (Math.PI / 2)))).toBeLessThan(1e-6);
  });
  it('vue du dessus, bloquée : rien ne tourne', () => {
    const { rig, views } = setup('locked');
    rig.look(300, 0, views);
    rig.rotate(1, views);
    expect(rig.getState().yaw).toBe(0);
  });
  it('3ème personne : toujours libre, même si la vue du dessus est bloquée', () => {
    const { rig, views } = setup('locked', 'third');
    rig.look(100, 0, views);
    expect(Math.abs(rig.getState().yaw)).toBeGreaterThan(0.1);
  });
  it('relâcher sans avoir tourné ne change rien', () => {
    const { rig, views } = setup('step');
    rig.endLook(views);
    expect(rig.getState().yaw).toBe(0);
  });
});
