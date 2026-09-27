import type { CardData } from '../types';

export type Priority = CardData['priority'];

/**
 * Single source of truth for how each priority reads across the UI:
 * badge pill, card left-accent rail and the details-editor dots.
 *
 * Priorities reuse the state ramps (danger for Urgent, warning for High, info
 * for Medium) so the palette lives in one place; Low stays neutral because it
 * is the absence of urgency rather than a state of its own.
 */
export const PRIORITY_META: Record<
  Priority,
  { label: string; badge: string; dot: string; rail: string; softBg: string }
> = {
  LOW: {
    label: 'Low',
    badge: 'bg-slate-100 text-slate-600 ring-slate-200',
    dot: 'bg-slate-400',
    rail: 'bg-slate-300',
    softBg: 'hover:bg-slate-50',
  },
  MEDIUM: {
    label: 'Medium',
    badge: 'bg-info-50 text-info-700 ring-info-200',
    dot: 'bg-info-500',
    rail: 'bg-info-400',
    softBg: 'hover:bg-info-50',
  },
  HIGH: {
    label: 'High',
    badge: 'bg-warning-50 text-warning-700 ring-warning-200',
    dot: 'bg-warning-500',
    rail: 'bg-warning-400',
    softBg: 'hover:bg-warning-50',
  },
  URGENT: {
    label: 'Urgent',
    badge: 'bg-danger-50 text-danger-700 ring-danger-200',
    dot: 'bg-danger-500',
    rail: 'bg-danger-500',
    softBg: 'hover:bg-danger-50',
  },
};

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
