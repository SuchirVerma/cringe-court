export type Outcome = 'violation' | 'clear' | 'inconclusive';
export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface Finding {
  chargeId: string;
  charge: string;
  exhibit: string;
  annexure: string;
  definition: string;
  tier: 1 | 2;
  at: string;
  outcome: Outcome;
  confidence: Confidence;
  proof: string | null;
  reason?: string;
  detail: Record<string, unknown>;
  quip: string | null;
  harm: string | null;
  remedies: string[];
}

export interface Verdict {
  url: string;
  host: string | null;
  tier: 1 | 2;
  siteName: string | null;
  guilty: boolean;
  ruled: boolean;
  determined: number;
  headline: string;
  score: number | null;
  outOf: number;
  counts: { charges: number; violations: number; cleared: number; inconclusive: number };
  remedies: { charge: string; exhibit: string; text: string }[];
  disclosure: { examined: string[]; notExamined: string[]; note: string };
  citation: { citation: string; authority: string; notified: string; instrument: string };
  durationMs: number | null;
}

export interface LogLine {
  id: number;
  level: 'info' | 'warn';
  message: string;
}

export type StreamEvent =
  | { type: 'log'; level: 'info' | 'warn'; message: string; at: number }
  | { type: 'opened'; url: string; host: string; tier: 1 | 2; siteName: string | null }
  | { type: 'charge-start'; chargeId: string; exhibit: string }
  | { type: 'finding'; finding: Finding }
  | { type: 'verdict'; verdict: Verdict }
  | { type: 'error'; message: string; detail?: string }
  | { type: 'done' };
