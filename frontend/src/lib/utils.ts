import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60)     return 'just now';
  if (s < 3600)   return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export function sourceLabel(src: string | null | undefined): string {
  if (!src) return 'Unknown';
  return src.includes(':') ? src.split(':')[0] : src;
}

const SKIP_TIMELINE = new Set([
  'newly discovered, timeline unspecified',
  'recent posting, timeline unspecified',
  'fresh posting, timeline unspecified',
]);

export function formatTimeline(timeline: string | null | undefined): string | null {
  if (!timeline) return null;
  const t = timeline.trim();
  if (SKIP_TIMELINE.has(t.toLowerCase())) return null;
  return t;
}

export function scoreVariant(score: number): 'high' | 'mid' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 65) return 'mid';
  return 'low';
}
