import type { Locator, Step } from './types';

export const sameLocator = (a: Locator, b: Locator) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Add a step, merging noise the browser produces:
 * - typing fires one input event per key, so fills on the same field merge into one
 * - clicking a text field right before filling it adds nothing
 */
export function addStep(steps: Step[], step: Step): Step[] {
  const last = steps.at(-1);
  if (step.type === 'fill' && last) {
    if (last.type === 'fill' && sameLocator(last.target, step.target)) {
      return [...steps.slice(0, -1), step];
    }
    if (last.type === 'click' && sameLocator(last.target, step.target)) {
      return [...steps.slice(0, -1), step];
    }
  }
  if (step.type === 'goto' && last?.type === 'goto') {
    return [...steps.slice(0, -1), step];
  }
  return [...steps, step];
}

export function removeStep(steps: Step[], index: number): Step[] {
  return steps.filter((_, i) => i !== index);
}

/** Field info used to decide if a value must not be recorded. */
export interface FieldInfo {
  type?: string | null;
  name?: string | null;
  id?: string | null;
  autocomplete?: string | null;
  sensitiveAttr?: boolean;
}

/** Returns an env var name (e.g. B2T_PASSWORD) if the field is sensitive, else undefined. */
export function sensitiveEnv(field: FieldInfo, sensitive: string[]): string | undefined {
  const hay = [field.name, field.id, field.autocomplete].filter(Boolean).join(' ').toLowerCase();
  const isPassword = field.type?.toLowerCase() === 'password';
  const hit = sensitive.find((s) => hay.includes(s.toLowerCase()));
  if (!isPassword && !hit && !field.sensitiveAttr) return undefined;
  const base = (field.name || field.id || hit || 'password').replace(/[^a-zA-Z0-9]+/g, '_');
  return `B2T_${base.toUpperCase()}`;
}
