import type { CardData } from '../types';

export type Priority = CardData['priority'];

/**
 * Single source of truth for how each priority reads across the UI:
 * badge pill, card left-accent rail and the details-editor dots.
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
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
    rail: 'bg-sky-400',
    softBg: 'hover:bg-sky-50',
  },
  HIGH: {
    label: 'High',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    rail: 'bg-amber-400',
    softBg: 'hover:bg-amber-50',
  },
  URGENT: {
    label: 'Urgent',
    badge: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    rail: 'bg-rose-500',
    softBg: 'hover:bg-rose-50',
  },
};

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
