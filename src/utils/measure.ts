import type { Vec3 } from '../types';

export function euclideanDistance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distanceInMeters(a: Vec3, b: Vec3, metersPerUnit: number): number {
  return euclideanDistance(a, b) * metersPerUnit;
}

export function formatMeters(meters: number, digits = 2): string {
  if (!Number.isFinite(meters)) return '-- m';
  return `${meters.toFixed(digits)} m`;
}

export function midpoint(a: Vec3, b: Vec3): Vec3 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2
  };
}
