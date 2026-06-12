import { describe, it, expect } from 'vitest';
import {
  clamp,
  lerp,
  easeLinear,
  easeInOutCubic,
  easeOutQuart,
  easeInOutSine,
  vec3Lerp,
  vec3Distance,
  vec3Add,
  vec3Scale,
  interpolateCameraPath,
  computeStepProgress,
  validateRouteSteps
} from './tour';
import type { Vec3 } from '../types';

describe('clamp', () => {
  it('t 在范围内保持不变', () => {
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it('t 小于最小值取最小值', () => {
    expect(clamp(-0.2, 0, 1)).toBe(0);
  });
  it('t 大于最大值取最大值', () => {
    expect(clamp(1.5, 0, 1)).toBe(1);
  });
});

describe('lerp', () => {
  it('t=0 返回起点', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it('t=1 返回终点', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it('t=0.5 线性中间值', () => {
    expect(lerp(10, 20, 0.5)).toBe(15);
  });
});

describe('easeLinear', () => {
  it('线性且截断到 [0,1]', () => {
    expect(easeLinear(0.3)).toBe(0.3);
    expect(easeLinear(-1)).toBe(0);
    expect(easeLinear(2)).toBe(1);
  });
});

describe('easeInOutCubic', () => {
  it('边界值正确', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
  });
  it('t=0.5 对称等于 0.5', () => {
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });
  it('起点缓入（导数较小）', () => {
    expect(easeInOutCubic(0.1)).toBeLessThan(easeLinear(0.1));
  });
  it('终点缓出（导数较小）', () => {
    expect(easeInOutCubic(0.9)).toBeGreaterThan(easeLinear(0.9));
  });
});

describe('easeOutQuart', () => {
  it('边界值', () => {
    expect(easeOutQuart(0)).toBe(0);
    expect(easeOutQuart(1)).toBe(1);
  });
  it('始终 ≥ 线性', () => {
    for (let t = 0; t <= 1; t += 0.1) {
      expect(easeOutQuart(t)).toBeGreaterThanOrEqual(t - 1e-9);
    }
  });
});

describe('easeInOutSine', () => {
  it('边界值', () => {
    expect(easeInOutSine(0)).toBeCloseTo(0, 6);
    expect(easeInOutSine(1)).toBeCloseTo(1, 6);
  });
  it('t=0.5 = 0.5', () => {
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 6);
  });
});

describe('vec3Lerp', () => {
  it('起点到终点线性插值', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 4, y: 6, z: 8 };
    expect(vec3Lerp(a, b, 0.5)).toEqual({ x: 2, y: 3, z: 4 });
  });
});

describe('vec3Distance', () => {
  it('同点距离 0', () => {
    const p: Vec3 = { x: 1, y: 2, z: 3 };
    expect(vec3Distance(p, p)).toBe(0);
  });
  it('(3,4,0) 距离 5', () => {
    expect(vec3Distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5, 6);
  });
});

describe('vec3Add & vec3Scale', () => {
  it('加法与缩放', () => {
    expect(vec3Add({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toEqual({ x: 5, y: 7, z: 9 });
    expect(vec3Scale({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 });
  });
});

describe('interpolateCameraPath', () => {
  const fromPos: Vec3 = { x: 0, y: 2, z: 5 };
  const fromTarget: Vec3 = { x: 0, y: 1, z: 0 };
  const toPos: Vec3 = { x: 4, y: 2, z: -3 };
  const toTarget: Vec3 = { x: 3, y: 1.2, z: -2 };

  it('t=0 返回起点附近', () => {
    const r = interpolateCameraPath(fromPos, fromTarget, toPos, toTarget, 0);
    expect(r.position.x).toBeCloseTo(fromPos.x, 3);
    expect(r.target).toEqual(fromTarget);
  });
  it('t=1 返回终点', () => {
    const r = interpolateCameraPath(fromPos, fromTarget, toPos, toTarget, 1);
    expect(r.position.x).toBeCloseTo(toPos.x, 3);
    expect(r.target).toEqual(toTarget);
  });
  it('路径中点高度高于两端平均（弧线）', () => {
    const r = interpolateCameraPath(fromPos, fromTarget, toPos, toTarget, 0.5, easeLinear);
    expect(r.position.y).toBeGreaterThan((fromPos.y + toPos.y) / 2);
  });
  it('支持自定义 easing', () => {
    const r1 = interpolateCameraPath(fromPos, fromTarget, toPos, toTarget, 0.2, easeLinear);
    const r2 = interpolateCameraPath(fromPos, fromTarget, toPos, toTarget, 0.2, easeInOutCubic);
    expect(r1.position.x).not.toBeCloseTo(r2.position.x, 5);
  });
});

describe('computeStepProgress', () => {
  it('duration <= 0 直接完成', () => {
    expect(computeStepProgress(100, 0)).toBe(1);
    expect(computeStepProgress(100, -10)).toBe(1);
  });
  it('未开始为 0，已完成为 1，中间按比例', () => {
    expect(computeStepProgress(0, 1000)).toBe(0);
    expect(computeStepProgress(500, 1000)).toBe(0.5);
    expect(computeStepProgress(1500, 1000)).toBe(1);
  });
});

describe('validateRouteSteps', () => {
  const available = ['hs-a', 'hs-b', 'hs-c', 'hs-d'];
  it('步骤数 < 3 不合法', () => {
    expect(validateRouteSteps(['hs-a', 'hs-b'], available)).toBe(false);
  });
  it('3 步且全部存在于可用热点', () => {
    expect(validateRouteSteps(['hs-a', 'hs-b', 'hs-c'], available)).toBe(true);
  });
  it('包含不存在的 hotspot id 不合法', () => {
    expect(validateRouteSteps(['hs-a', 'hs-b', 'hs-missing'], available)).toBe(false);
  });
});
