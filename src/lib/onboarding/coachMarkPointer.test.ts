import { describe, expect, it } from 'vitest';
import { pointerGeometry } from './coachMarkPointer';

/** The numbers of a path, in order. */
function numbers(path: string): number[] {
  return (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
}

describe('pointerGeometry', () => {
  it('waits for a measured box and a measured launcher', () => {
    expect(pointerGeometry({ width: 0, height: 0 }, 120)).toBeNull();
    expect(pointerGeometry({ width: 160, height: 80 }, 0)).toBeNull();
  });

  it('draws nothing in a box too small to hold a pointer', () => {
    expect(pointerGeometry({ width: 20, height: 80 }, 120)).toBeNull();
    expect(pointerGeometry({ width: 160, height: 20 }, 120)).toBeNull();
  });

  it('runs from the end of the callout to above the centre of the launcher', () => {
    const geometry = pointerGeometry({ width: 160, height: 80 }, 120);
    if (geometry === null) throw new Error('no pointer');
    const curve = numbers(geometry.curve);
    // M start, C control one, control two, end.
    expect(curve.slice(0, 2)).toEqual([6, 18]);
    expect(curve.slice(-2)).toEqual([100, 80]);
  });

  it('keeps every point of the curve inside the box', () => {
    for (const box of [
      { width: 136, height: 84 },
      { width: 160, height: 80 },
      { width: 40, height: 30 },
    ]) {
      const geometry = pointerGeometry(box, 120);
      if (geometry === null) throw new Error('no pointer');
      const curve = numbers(geometry.curve);
      for (let index = 0; index < curve.length; index += 2) {
        const x = curve[index] ?? Number.NaN;
        const y = curve[index + 1] ?? Number.NaN;
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(box.height);
        expect(x).toBeGreaterThan(0);
      }
    }
  });

  it('points the arrowhead along the arrival, with its tip at the end', () => {
    const geometry = pointerGeometry({ width: 160, height: 80 }, 120);
    if (geometry === null) throw new Error('no pointer');
    const [leftX, leftY, tipX, tipY, rightX, rightY] = numbers(geometry.head);
    expect([tipX, tipY]).toEqual([100, 80]);
    // Both wings trail above the tip, since the stroke arrives from above.
    expect(leftY).toBeLessThan(80);
    expect(rightY).toBeLessThan(80);
    // The wings are the same length from the tip.
    const wing = (x: number, y: number) =>
      Math.hypot(x - (tipX ?? 0), y - (tipY ?? 0));
    expect(wing(leftX ?? 0, leftY ?? 0)).toBeCloseTo(
      wing(rightX ?? 0, rightY ?? 0),
      0,
    );
  });
});
