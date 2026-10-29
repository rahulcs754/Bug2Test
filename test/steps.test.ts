import { describe, expect, it } from 'vitest';
import { addStep, removeStep, sensitiveEnv } from '../src/core/steps';
import { DEFAULT_SETTINGS, type Step } from '../src/core/types';

const email = { kind: 'label', value: 'Email' } as const;

describe('addStep', () => {
  it('merges typing into one fill', () => {
    let steps: Step[] = [];
    for (const value of ['a', 'ab', 'abc']) steps = addStep(steps, { type: 'fill', target: email, value });
    expect(steps).toEqual([{ type: 'fill', target: email, value: 'abc' }]);
  });

  it('drops the click that focused the field', () => {
    let steps: Step[] = [{ type: 'click', target: email }];
    steps = addStep(steps, { type: 'fill', target: email, value: 'x' });
    expect(steps).toHaveLength(1);
    expect(steps[0]!.type).toBe('fill');
  });

  it('keeps fills on different fields', () => {
    let steps: Step[] = [{ type: 'fill', target: email, value: 'x' }];
    steps = addStep(steps, { type: 'fill', target: { kind: 'label', value: 'Name' }, value: 'y' });
    expect(steps).toHaveLength(2);
  });

  it('removeStep removes by index', () => {
    expect(removeStep([{ type: 'goto', url: 'a' }, { type: 'goto', url: 'b' }], 0)).toEqual([{ type: 'goto', url: 'b' }]);
  });
});

describe('sensitiveEnv', () => {
  const list = DEFAULT_SETTINGS.sensitive;
  it('flags password inputs', () => {
    expect(sensitiveEnv({ type: 'password', name: 'pwd' }, list)).toBe('B2T_PWD');
  });
  it('flags by name', () => {
    expect(sensitiveEnv({ type: 'text', name: 'otp-code' }, list)).toBe('B2T_OTP_CODE');
    expect(sensitiveEnv({ type: 'text', id: 'cardNumber' }, list)).toBe('B2T_CARDNUMBER');
  });
  it('flags data-bug2test-sensitive', () => {
    expect(sensitiveEnv({ type: 'text', sensitiveAttr: true }, list)).toBe('B2T_PASSWORD');
  });
  it('lets normal fields through', () => {
    expect(sensitiveEnv({ type: 'email', name: 'email' }, list)).toBeUndefined();
  });
});

describe('originPattern', () => {
  it('drops the port and path', async () => {
    const { originPattern } = await import('../src/shared/origin');
    expect(originPattern('http://localhost:3000/cart?x=1')).toBe('http://localhost/*');
    expect(originPattern('https://shop.example.com/a')).toBe('https://shop.example.com/*');
  });
});
