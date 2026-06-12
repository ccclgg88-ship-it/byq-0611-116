import * as THREE from 'three';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export function aabbFromBox3(box: THREE.Box3): AABB {
  return { min: box.min.clone(), max: box.max.clone() };
}

export function aabbFromCenterSize(center: THREE.Vector3, size: THREE.Vector3): AABB {
  const half = size.clone().multiplyScalar(0.5);
  return {
    min: center.clone().sub(half),
    max: center.clone().add(half)
  };
}

export function aabbIntersectsPoint(aabb: AABB, point: THREE.Vector3, radius = 0): boolean {
  return (
    point.x + radius >= aabb.min.x &&
    point.x - radius <= aabb.max.x &&
    point.y + radius >= aabb.min.y &&
    point.y - radius <= aabb.max.y &&
    point.z + radius >= aabb.min.z &&
    point.z - radius <= aabb.max.z
  );
}

export function resolveAABBCollision(
  position: THREE.Vector3,
  prevPosition: THREE.Vector3,
  walls: AABB[],
  radius: number
): THREE.Vector3 {
  const result = position.clone();
  for (const wall of walls) {
    if (!aabbIntersectsPoint(wall, result, radius)) continue;

    const testX = prevPosition.clone();
    testX.x = result.x;
    testX.z = prevPosition.z;
    const collidesX = aabbIntersectsPoint(wall, testX, radius);

    const testZ = prevPosition.clone();
    testZ.x = prevPosition.x;
    testZ.z = result.z;
    const collidesZ = aabbIntersectsPoint(wall, testZ, radius);

    if (collidesX && !collidesZ) {
      result.x = prevPosition.x;
    } else if (collidesZ && !collidesX) {
      result.z = prevPosition.z;
    } else if (collidesX && collidesZ) {
      result.x = prevPosition.x;
      result.z = prevPosition.z;
    }
  }
  return result;
}

export function extractAABBsFromObject(obj: THREE.Object3D, filterName?: RegExp): AABB[] {
  const results: AABB[] = [];
  const box = new THREE.Box3();
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (filterName && !filterName.test(child.name ?? '')) return;
    box.setFromObject(child);
    if (box.isEmpty()) return;
    results.push(aabbFromBox3(box));
  });
  return results;
}
