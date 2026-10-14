import { describe, expect, it } from 'vitest';
import { MACHINES } from '../core/data/machines';
import { MOTIONS, poseOf, pulse, ROCKER_DEFAULT, rockerPose } from './partMotions';
import { TERRA_MODELS } from './models';

const Y = { x: 0, y: 1, z: 0 };

describe('mouvements des pièces mobiles', () => {
  it('une rotation continue reprend l’angle cumulé', () => {
    expect(poseOf({ kind: 'spin', speed: 3 }, 5, 1.25, null, Y).angle).toBe(1.25);
  });

  it('un va-et-vient passe par les deux côtés ; à sens unique il reste du même côté', () => {
    const both = [0, 0.25, 0.5, 0.75].map(
      (p) => poseOf({ kind: 'swing', angle: 1, period: 4 }, p * 4, 0, null, Y).angle,
    );
    expect(Math.max(...both)).toBeCloseTo(1, 5);
    expect(Math.min(...both)).toBeCloseTo(-1, 5);
    const one = [0, 0.25, 0.5, 0.75].map(
      (p) =>
        poseOf({ kind: 'swing', angle: 1, period: 4, oneSided: true }, p * 4, 0, null, Y).angle,
    );
    expect(Math.min(...one)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...one)).toBeCloseTo(1, 5);
  });

  it('la presse reste en haut puis s’abat en fin de cycle', () => {
    const m = { kind: 'press', depth: 0.2 } as const;
    expect(poseOf(m, 0, 0, 0.3, Y).dy).toBeCloseTo(0, 6);
    expect(poseOf(m, 0, 0, 0.875, Y).dy).toBeCloseTo(-0.2, 5);
  });

  it('la bosse est nulle hors de la fenêtre et maximale au milieu', () => {
    expect(pulse(0.1, 0.25, 0.75)).toBe(0);
    expect(pulse(0.5, 0.25, 0.75)).toBeCloseTo(1, 5);
    expect(pulse(0.9, 0.25, 0.75)).toBe(0);
  });

  it('le glissement suit l’axe du pivot, ou une direction du modèle', () => {
    const loop = poseOf(
      { kind: 'slide', dir: 'axis', amount: 1, period: 2, shape: 'loop' },
      1,
      0,
      null,
      { x: 0, y: 0.6, z: 0.8 },
    );
    expect(loop.dy).toBeCloseTo(0.3, 5);
    expect(loop.dz).toBeCloseTo(0.4, 5);
    const down = poseOf(
      { kind: 'slide', dir: 'down', amount: 1, period: 4, shape: 'pulse' },
      2,
      0,
      null,
      Y,
    );
    expect(down.dy).toBeCloseTo(-1, 5);
  });

  it('les quarts de tour s’ajoutent période après période', () => {
    const m = { kind: 'step', angle: Math.PI / 2, period: 4 } as const;
    expect(poseOf(m, 3.9, 0, null, Y).angle).toBeCloseTo(Math.PI / 2, 5);
    expect(poseOf(m, 7.9, 0, null, Y).angle).toBeCloseTo(Math.PI, 5);
  });
});

describe('chevalet de pompage', () => {
  it('la bielle garde sa longueur et le balancier bouge sans saut sur un tour', () => {
    const g = ROCKER_DEFAULT;
    let prev = 0;
    let max = 0;
    let min = 0;
    let jump = 0;
    let last = 0;
    for (let i = 0; i <= 360; i++) {
      const p = rockerPose(g, (i / 360) * Math.PI * 2, prev);
      prev = p.rocker;
      max = Math.max(max, p.rocker);
      min = Math.min(min, p.rocker);
      jump = Math.max(jump, Math.abs(p.rocker - last));
      last = p.rocker;
    }
    expect(jump).toBeLessThan(0.08);
    expect(max - min).toBeGreaterThan(0.6); // plus de 35° d'amplitude totale
    expect(max - min).toBeLessThan(1.4);
  });

  it('au repos (manivelle à 0) rien ne bouge', () => {
    const p = rockerPose(ROCKER_DEFAULT, 0, 0);
    expect(p.rocker).toBeCloseTo(0, 6);
    expect(p.rod).toBeCloseTo(0, 6);
    expect(p.link).toBeCloseTo(0, 6);
  });
});

describe('table des mouvements', () => {
  it('ne vise que des machines qui existent, et que des machines à modèle maison', () => {
    const ids = new Set(MACHINES.map((m) => m.id as string));
    for (const type of Object.keys(MOTIONS)) {
      expect(ids.has(type), type).toBe(true);
      expect(TERRA_MODELS, type).toHaveProperty(type);
    }
  });

  it('une pièce portée désigne un groupe de la même machine', () => {
    for (const [type, groups] of Object.entries(MOTIONS))
      for (const [name, motion] of Object.entries(groups ?? {}))
        if (motion.parent)
          expect(Object.keys(groups ?? {}), `${type}/${name}`).toContain(motion.parent);
  });
});
