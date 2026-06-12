import type { Vec3 } from '../types';

export function clamp(t: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeLinear(t: number): number {
  return clamp(t, 0, 1);
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutQuart(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 4);
}

export function easeInOutSine(t: number): number {
  const x = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t)
  };
}

export function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function interpolateCameraPath(
  fromPos: Vec3,
  fromTarget: Vec3,
  toPos: Vec3,
  toTarget: Vec3,
  rawT: number,
  easing: (t: number) => number = easeInOutCubic
): { position: Vec3; target: Vec3 } {
  const t = easing(rawT);
  const midOffset = vec3Scale(vec3Add(fromTarget, toTarget), 0.5);
  midOffset.y = Math.max(fromPos.y, toPos.y) + 0.8;
  const p0 = fromPos;
  const p2 = toPos;
  const arcPos: Vec3 = {
    x: lerp(lerp(p0.x, midOffset.x, t), lerp(midOffset.x, p2.x, t), t),
    y: lerp(lerp(p0.y, midOffset.y, t), lerp(midOffset.y, p2.y, t), t),
    z: lerp(lerp(p0.z, midOffset.z, t), lerp(midOffset.z, p2.z, t), t)
  };
  return {
    position: arcPos,
    target: vec3Lerp(fromTarget, toTarget, t)
  };
}

export function computeStepProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return clamp(elapsedMs / durationMs, 0, 1);
}

export function validateRouteSteps(stepHotspotIds: string[], availableHotspotIds: string[]): boolean {
  if (stepHotspotIds.length < 3) return false;
  return stepHotspotIds.every((id) => availableHotspotIds.includes(id));
}
