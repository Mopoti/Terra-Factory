import { describe, expect, it } from 'vitest';
import {
  damp,
  edgePan,
  ghostOpacity,
  ghostRadiusPx,
  limitCameraDistance,
  lookDirection,
  orbitOffset,
  smoothingRate,
  snapToQuarterTurn,
  wrapAngle,
  zoomFactor,
} from './cameraMath';

describe('lissage', () => {
  it('0 % = instantané', () => {
    expect(damp(0, 10, smoothingRate(0), 0.016)).toBe(10);
  });
  it('plus de lissage = rattrapage plus lent', () => {
    const light = damp(0, 10, smoothingRate(20), 0.05);
    const heavy = damp(0, 10, smoothingRate(100), 0.05);
    expect(light).toBeGreaterThan(heavy);
    expect(heavy).toBeGreaterThan(0);
  });
  it("ne dépend pas du nombre d'images par seconde", () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = damp(a, 10, 8, 1 / 60);
    let b = 0;
    for (let i = 0; i < 30; i++) b = damp(b, 10, 8, 1 / 30);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('angles', () => {
  it('ramène un angle dans ]-π, π]', () => {
    expect(Math.abs(wrapAngle(3 * Math.PI))).toBeCloseTo(Math.PI, 6); // ±π : même direction
    expect(wrapAngle(2 * Math.PI + 0.25)).toBeCloseTo(0.25, 6);
    expect(wrapAngle(-2 * Math.PI - 0.25)).toBeCloseTo(-0.25, 6);
    expect(wrapAngle(0.5)).toBeCloseTo(0.5, 6);
  });
  it('arrondit à un quart de tour', () => {
    expect(snapToQuarterTurn(1.0)).toBeCloseTo(Math.PI / 2, 6); // 57° -> 90°
    expect(snapToQuarterTurn(1.0 + Math.PI)).toBeCloseTo((3 * Math.PI) / 2, 6);
    expect(snapToQuarterTurn(0.7)).toBe(0); // 40° -> 0°
    expect(snapToQuarterTurn(-1.0)).toBeCloseTo(-Math.PI / 2, 6);
  });
  it('direction du regard : yaw 0 = vers -z, pencher vers le bas descend', () => {
    const d = lookDirection(0, 0);
    expect(d.z).toBeCloseTo(-1, 6);
    expect(lookDirection(0, 0.5).y).toBeLessThan(0);
    const e = lookDirection(Math.PI / 2, 0);
    expect(e.x).toBeCloseTo(-1, 6);
    expect(Math.hypot(e.x, e.y, e.z)).toBeCloseTo(1, 6);
  });
  it('la caméra orbite derrière la cible', () => {
    const o = orbitOffset(0, 0, 5);
    expect(o.z).toBeCloseTo(5, 6);
    expect(o.y).toBeCloseTo(0, 6);
    const top = orbitOffset(0, Math.PI / 2, 8);
    expect(top.y).toBeCloseTo(8, 6);
    expect(Math.hypot(top.x, top.z)).toBeLessThan(1e-6);
  });
});

describe('défilement par les bords', () => {
  it('rien au milieu, plein effet dans le coin', () => {
    expect(edgePan(500, 300, 1000, 600)).toEqual({ x: 0, y: 0 });
    const corner = edgePan(0, 0, 1000, 600);
    expect(corner.x).toBe(-1);
    expect(corner.y).toBe(1); // haut de l'écran = +y
    expect(edgePan(1000, 600, 1000, 600)).toEqual({ x: 1, y: -1 });
  });
});

describe('collision de la caméra', () => {
  const dir = { x: 0, y: 0, z: 1 };
  it('libre : distance demandée', () => {
    expect(limitCameraDistance({ x: 0, y: 1.5, z: 0 }, dir, 6, () => false)).toBe(6);
  });
  it('un obstacle raccourcit la distance, sans passer sous un minimum', () => {
    const wall = (_x: number, _y: number, z: number): boolean => z > 3;
    const d = limitCameraDistance({ x: 0, y: 1.5, z: 0 }, dir, 6, wall);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(3.2);
    const close = limitCameraDistance({ x: 0, y: 1.5, z: 0 }, dir, 6, (_x, _y, z) => z > 0.4);
    expect(close).toBe(0.6);
  });
  it('ne descend pas sous le sol', () => {
    const down = { x: 0, y: -1, z: 0 };
    expect(limitCameraDistance({ x: 0, y: 2, z: 0 }, down, 10, () => false)).toBeLessThan(2);
  });
});

describe('aura de transparence', () => {
  it('très transparente près du joueur, opaque loin', () => {
    expect(ghostOpacity(0, 100)).toBeLessThan(0.15);
    expect(ghostOpacity(100, 100)).toBe(1);
    expect(ghostOpacity(300, 100)).toBe(1);
  });
  it('de moins en moins transparente en s’éloignant', () => {
    let last = -1;
    for (let d = 0; d <= 100; d += 10) {
      const o = ghostOpacity(d, 100);
      expect(o).toBeGreaterThanOrEqual(last);
      last = o;
    }
  });
  it('le rayon suit le réglage et la taille de l’écran', () => {
    expect(ghostRadiusPx(50, 800)).toBeCloseTo(120, 6);
    expect(ghostRadiusPx(100, 800)).toBeGreaterThan(ghostRadiusPx(10, 800));
  });
});

describe('zoom', () => {
  it('plus de vitesse = plus gros pas', () => {
    expect(zoomFactor(100)).toBeGreaterThan(zoomFactor(50));
    expect(zoomFactor(50)).toBeCloseTo(1.2, 6);
    expect(zoomFactor(0)).toBeCloseTo(zoomFactor(10), 6);
  });
});
