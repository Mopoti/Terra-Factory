import * as THREE from 'three';
import type { PlayerState, ViewId } from '../core/save/saveIndex';
import type { Settings } from '../settings/schema';
import {
  clamp,
  damp,
  limitCameraDistance,
  lookDirection,
  orbitOffset,
  smoothingRate,
  snapToQuarterTurn,
  wrapAngle,
  zoomFactor,
} from './cameraMath';

export const EYE_HEIGHT_M = 1.6;
const TOP_FOV = 40;
const PAN_SPEED_M_S = 14;
const PAN_MAX_M = 16;
const PITCH_LIMIT = 1.45;
const ORBIT_PITCH_MIN = 0.12;
const ORBIT_PITCH_MAX = 1.45;
const SHOULDER_OFFSET_M = 0.6;
const STEP_YAW_RATE = 9;

export const VIEW_ORDER: readonly ViewId[] = ['first', 'third', 'top'];

export interface RigMotion {
  /** Vitesse de marche actuelle (m/s). */
  speed: number;
  /** -1 (gauche) à 1 (droite). */
  strafe: number;
}

/**
 * Les trois caméras (1ère personne, 3ème personne, vue du dessus) et leurs réglages.
 * Le « yaw » est partagé : on garde son cap en changeant de vue.
 */
export class CameraRig {
  view: ViewId;
  /** Cap affiché (lissé). Sert aussi à orienter les déplacements. */
  yaw: number;
  private yawTarget: number;
  private lookPitch: number;
  private lookPitchShown: number;
  private orbitPitch: number;
  private orbitPitchShown: number;
  private thirdDistance: number;
  private topZoom: number;
  private readonly pan = new THREE.Vector2();
  private readonly shown = new THREE.Vector3();
  private shownReady = false;
  private bobPhase = 0;
  private bobAmount = 0;
  private roll = 0;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    state: PlayerState,
  ) {
    this.view = state.view;
    this.yaw = this.yawTarget = state.yaw;
    this.lookPitch = this.lookPitchShown = state.firstPitch;
    this.orbitPitch = this.orbitPitchShown = state.pitch;
    this.thirdDistance = state.distance;
    this.topZoom = state.topZoom;
  }

  getState(): Pick<PlayerState, 'yaw' | 'pitch' | 'distance' | 'view' | 'firstPitch' | 'topZoom'> {
    return {
      yaw: this.yawTarget,
      pitch: this.orbitPitch,
      distance: this.thirdDistance,
      view: this.view,
      firstPitch: this.lookPitch,
      topZoom: this.topZoom,
    };
  }

  setView(view: ViewId, views: Settings['views']): void {
    if (view === this.view) return;
    this.view = view;
    this.shownReady = false;
    if (view === 'top' && views.top.rotation === 'step')
      this.yawTarget = snapToQuarterTurn(this.yawTarget);
  }

  cycleView(views: Settings['views']): void {
    const next = VIEW_ORDER[(VIEW_ORDER.indexOf(this.view) + 1) % VIEW_ORDER.length];
    this.setView(next, views);
  }

  /** Mouvement de souris (pixels) : regarder autour. */
  look(dx: number, dy: number, views: Settings['views']): void {
    const k = 0.005 * (views.common.mouseSensitivity / 50);
    const sign = views.common.invertY ? -1 : 1;
    const yawAllowed = this.view !== 'top' || views.top.rotation === 'free';
    if (yawAllowed) this.yawTarget -= dx * k;
    if (this.view === 'first')
      this.lookPitch = clamp(this.lookPitch + dy * k * sign, -PITCH_LIMIT, PITCH_LIMIT);
    else if (this.view === 'third') {
      this.orbitPitch = clamp(this.orbitPitch + dy * k * sign, ORBIT_PITCH_MIN, ORBIT_PITCH_MAX);
    }
  }

  /** Rotation automatique : le cap rejoint doucement la direction de marche (3ème personne). */
  followHeading(dirX: number, dirZ: number, dt: number): void {
    const target = Math.atan2(-dirX, -dirZ);
    this.yawTarget += wrapAngle(target - this.yawTarget) * Math.min(1, dt * 1.6);
  }

  /** Rotation continue (touches de rotation maintenues). */
  rotate(radians: number, views: Settings['views']): void {
    if (this.view === 'top' && views.top.rotation !== 'free') return;
    this.yawTarget += radians;
  }

  /** Quart de tour (vue du dessus en mode « par pas de 90° »). */
  rotateStep(direction: 1 | -1, views: Settings['views']): void {
    if (this.view === 'top' && views.top.rotation === 'step') {
      this.yawTarget = snapToQuarterTurn(this.yawTarget) + (direction * Math.PI) / 2;
    } else this.rotate(direction * 0.3, views);
  }

  /** Un cran de zoom : direction 1 = se rapprocher. */
  zoom(direction: 1 | -1, views: Settings['views']): void {
    if (this.view === 'third') {
      const f = zoomFactor(50);
      this.thirdDistance = clamp(
        direction > 0 ? this.thirdDistance / f : this.thirdDistance * f,
        1.5,
        10,
      );
    } else if (this.view === 'top') {
      const f = zoomFactor(views.top.zoomSpeed);
      const next = direction > 0 ? this.topZoom / f : this.topZoom * f;
      this.topZoom = clamp(next, views.top.zoomMin, Math.max(views.top.zoomMin, views.top.zoomMax));
    }
  }

  /** Les réglages peuvent avoir changé (zoom min/max, distance par défaut). */
  applyViewSettings(views: Settings['views']): void {
    this.topZoom = clamp(
      this.topZoom,
      views.top.zoomMin,
      Math.max(views.top.zoomMin, views.top.zoomMax),
    );
    if (this.view === 'top' && views.top.rotation === 'step') {
      this.yawTarget = snapToQuarterTurn(this.yawTarget);
    }
  }

  /**
   * Place la caméra. `edge` : défilement par les bords (-1…1) ;
   * `blockedAt` : le point (x, y, z) est-il dans un arbre / rocher ? (collision de la caméra).
   */
  update(
    dt: number,
    player: { x: number; z: number },
    motion: RigMotion,
    views: Settings['views'],
    edge: { x: number; y: number },
    blockedAt: (x: number, y: number, z: number) => boolean,
  ): void {
    const rate = smoothingRate(views.common.smoothing);
    const stepMode = this.view === 'top' && views.top.rotation === 'step';
    const previousYaw = this.yaw;
    this.yaw = damp(this.yaw, this.yawTarget, stepMode ? STEP_YAW_RATE : rate, dt);
    this.lookPitchShown = damp(this.lookPitchShown, this.lookPitch, rate, dt);
    this.orbitPitchShown = damp(this.orbitPitchShown, this.orbitPitch, rate, dt);

    let fov: number;
    let desired: THREE.Vector3;
    let focus: THREE.Vector3;
    const up = new THREE.Vector3(0, 1, 0);

    if (this.view === 'first') {
      fov = views.first.fov;
      this.bobAmount = damp(this.bobAmount, motion.speed > 0.1 ? 1 : 0, 10, dt);
      this.bobPhase += motion.speed * dt * 1.7;
      const intensity = views.first.headBob ? views.first.headBobIntensity / 50 : 0;
      const bobY = Math.sin(this.bobPhase * 2) * 0.035 * intensity * this.bobAmount;
      const bobX = Math.sin(this.bobPhase) * 0.02 * intensity * this.bobAmount;
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);
      desired = new THREE.Vector3(
        player.x + rightX * bobX,
        EYE_HEIGHT_M + bobY,
        player.z + rightZ * bobX,
      );
      const dir = lookDirection(this.yaw, this.lookPitchShown);
      focus = desired.clone().add(new THREE.Vector3(dir.x, dir.y, dir.z));
      const yawRate = dt > 0 ? wrapAngle(this.yaw - previousYaw) / dt : 0;
      const rollTarget = views.first.tilt
        ? clamp(-motion.strafe * 0.03 + yawRate * 0.004, -0.06, 0.06)
        : 0;
      this.roll = damp(this.roll, rollTarget, 8, dt);
      this.camera.position.copy(desired);
      this.camera.up.copy(up);
      this.camera.lookAt(focus);
      this.camera.rotateZ(this.roll);
      this.shownReady = false;
    } else if (this.view === 'third') {
      fov = views.third.fov;
      const shoulder =
        views.third.shoulder === 'left' ? -1 : views.third.shoulder === 'right' ? 1 : 0;
      const rightX = Math.cos(this.yaw);
      const rightZ = -Math.sin(this.yaw);
      const pivot = new THREE.Vector3(
        player.x + rightX * shoulder * SHOULDER_OFFSET_M,
        views.third.height,
        player.z + rightZ * shoulder * SHOULDER_OFFSET_M,
      );
      const unit = orbitOffset(this.yaw, this.orbitPitchShown, 1);
      const wanted = this.thirdDistance;
      const distance = views.third.collision
        ? limitCameraDistance(pivot, unit, wanted, blockedAt)
        : wanted;
      desired = new THREE.Vector3(
        pivot.x + unit.x * distance,
        pivot.y + unit.y * distance,
        pivot.z + unit.z * distance,
      );
      focus = pivot;
      this.settle(desired, rate, dt);
      this.camera.up.copy(up);
      this.camera.lookAt(focus);
      this.roll = 0;
    } else {
      fov = TOP_FOV;
      if (views.top.edgeScroll) {
        const rx = Math.cos(this.yaw);
        const rz = -Math.sin(this.yaw);
        const fx = -Math.sin(this.yaw);
        const fz = -Math.cos(this.yaw);
        this.pan.x += (rx * edge.x + fx * edge.y) * PAN_SPEED_M_S * dt;
        this.pan.y += (rz * edge.x + fz * edge.y) * PAN_SPEED_M_S * dt;
      }
      if (!views.top.edgeScroll || (edge.x === 0 && edge.y === 0)) {
        this.pan.multiplyScalar(Math.exp(-3 * dt));
      }
      if (this.pan.length() > PAN_MAX_M) this.pan.setLength(PAN_MAX_M);
      const elevation = (views.top.angle * Math.PI) / 180;
      const zoom = clamp(
        this.topZoom,
        views.top.zoomMin,
        Math.max(views.top.zoomMin, views.top.zoomMax),
      );
      focus = new THREE.Vector3(player.x + this.pan.x, 0, player.z + this.pan.y);
      const o = orbitOffset(this.yaw, elevation, zoom);
      desired = new THREE.Vector3(focus.x + o.x, o.y, focus.z + o.z);
      this.settle(desired, rate, dt);
      // Presque à la verticale, « le haut de l'écran » est la direction du regard.
      if (elevation > 1.5) up.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.camera.up.copy(up);
      this.camera.lookAt(focus);
      this.roll = 0;
    }

    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Déplace la caméra vers `desired` avec le lissage choisi (instantané à 0 %). */
  private settle(desired: THREE.Vector3, rate: number, dt: number): void {
    if (!this.shownReady || !Number.isFinite(rate)) {
      this.shown.copy(desired);
      this.shownReady = true;
    } else {
      this.shown.x = damp(this.shown.x, desired.x, rate, dt);
      this.shown.y = damp(this.shown.y, desired.y, rate, dt);
      this.shown.z = damp(this.shown.z, desired.z, rate, dt);
    }
    this.camera.position.copy(this.shown);
  }
}
