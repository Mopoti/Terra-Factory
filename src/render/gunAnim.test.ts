import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GUN_PROFILES, GunRig, boltCycle, kick, reloadPose } from './gunAnim';

describe('animations des armes', () => {
  it('le recul monte vite puis revient à zéro', () => {
    expect(kick(0)).toBe(0);
    expect(kick(0.18)).toBeCloseTo(1);
    expect(kick(0.6)).toBeGreaterThan(0);
    expect(kick(0.6)).toBeLessThan(1);
    expect(kick(1)).toBe(0);
  });

  it('le verrou se lève avant de reculer et se rabat après être revenu', () => {
    expect(boltCycle(0.1).turn).toBeGreaterThan(0);
    expect(boltCycle(0.1).pull).toBe(0);
    expect(boltCycle(0.5).turn).toBeCloseTo(1);
    expect(boltCycle(0.5).pull).toBeCloseTo(1);
    expect(boltCycle(0.9).pull).toBe(0);
    expect(boltCycle(1)).toEqual({ turn: 0, pull: 0 });
  });

  it('au rechargement, le chargeur sort, disparaît, un plein revient, puis on réarme', () => {
    expect(reloadPose('rifle', 0.3).mag).toBeGreaterThan(0.8);
    expect(reloadPose('rifle', 0.4).magVisible).toBe(false);
    expect(reloadPose('rifle', 0.75).mag).toBeCloseTo(0);
    expect(reloadPose('rifle', 0.75).magVisible).toBe(true);
    expect(reloadPose('rifle', 0.86).slide).toBeGreaterThan(0.9);
    expect(reloadPose('sniper', 0.86).bolt).toBeGreaterThan(0);
    expect(reloadPose('pistol', 1)).toEqual({
      tilt: 0,
      mag: 0,
      magVisible: true,
      slide: 0,
      bolt: 0,
    });
  });

  it('GunRig fait reculer la culasse au tir et bloque le tir pendant le rechargement', () => {
    const wrapper = new THREE.Group();
    const model = new THREE.Group();
    const slide = new THREE.Object3D();
    slide.name = 'culasse';
    const mag = new THREE.Object3D();
    mag.name = 'chargeur';
    const muzzle = new THREE.Object3D();
    muzzle.name = 'bouche';
    model.add(slide, mag, muzzle);
    wrapper.add(model);
    const rig = new GunRig('pistol', wrapper, 1);
    rig.fire();
    rig.update(GUN_PROFILES.pistol.recoilS * 0.18);
    expect(slide.position.z).toBeLessThan(-0.02);
    rig.update(1);
    expect(slide.position.z).toBeCloseTo(0);
    expect(rig.busy).toBe(false);
    rig.reload();
    expect(rig.busy).toBe(true);
    rig.update(GUN_PROFILES.pistol.reloadS * 0.4);
    expect(mag.visible).toBe(false);
    rig.update(GUN_PROFILES.pistol.reloadS);
    expect(rig.busy).toBe(false);
    expect(mag.visible).toBe(true);
    expect(mag.position.length()).toBeCloseTo(0);
  });
});
