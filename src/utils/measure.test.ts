import { describe, it, expect } from 'vitest';
import { euclideanDistance, distanceInMeters, formatMeters, midpoint } from './measure';
import type { Vec3 } from '../types';

describe('euclideanDistance', () => {
  it('同一位置距离为 0', () => {
    const p: Vec3 = { x: 1, y: 2, z: 3 };
    expect(euclideanDistance(p, p)).toBe(0);
  });

  it('沿 X 轴 3 单位距离', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 3, y: 0, z: 0 };
    expect(euclideanDistance(a, b)).toBeCloseTo(3.0, 6);
  });

  it('3D 对角 (3,4,0) = 5', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 3, y: 4, z: 0 };
    expect(euclideanDistance(a, b)).toBeCloseTo(5.0, 6);
  });

  it('3D 任意向量 (1,2,3)', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 1, y: 2, z: 3 };
    expect(euclideanDistance(a, b)).toBeCloseTo(Math.sqrt(1 + 4 + 9), 6);
  });
});

describe('distanceInMeters', () => {
  it('metersPerUnit = 1 与欧式距离相同', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 2, y: 0, z: 0 };
    expect(distanceInMeters(a, b, 1)).toBeCloseTo(2.0, 6);
  });

  it('metersPerUnit = 0.5 缩放', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 4, y: 0, z: 0 };
    expect(distanceInMeters(a, b, 0.5)).toBeCloseTo(2.0, 6);
  });

  it('metersPerUnit = 10（模型单位厘米时）', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 0.25, y: 0, z: 0 };
    expect(distanceInMeters(a, b, 10)).toBeCloseTo(2.5, 6);
  });
});

describe('formatMeters', () => {
  it('保留 2 位小数并加单位', () => {
    expect(formatMeters(2.543)).toBe('2.54 m');
  });

  it('自定义小数位', () => {
    expect(formatMeters(2.543, 0)).toBe('3 m');
  });

  it('NaN / Infinity 返回 -- m', () => {
    expect(formatMeters(NaN)).toBe('-- m');
    expect(formatMeters(Infinity)).toBe('-- m');
  });
});

describe('midpoint', () => {
  it('两点的中点', () => {
    const a: Vec3 = { x: 0, y: 0, z: 0 };
    const b: Vec3 = { x: 2, y: 4, z: 6 };
    expect(midpoint(a, b)).toEqual({ x: 1, y: 2, z: 3 });
  });
});
