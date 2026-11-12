import type { ScanicCornerQuad } from './scanic-detector.js';

export interface ScanicMlDetectResult {
  success: boolean;
  corners: ScanicCornerQuad | null;
  confidence: number | null;
  score: number | null;
  message: string;
  timings?: Array<{ step: string; ms: string }>;
}

export function initializeMl(options?: Record<string, unknown>): Promise<void>;

export function detectDocumentMl(
  image: unknown,
  options?: Record<string, unknown>
): Promise<ScanicMlDetectResult>;
