export interface ScanicPoint {
  x: number;
  y: number;
}

export interface ScanicCornerQuad {
  topLeft: ScanicPoint;
  topRight: ScanicPoint;
  bottomRight: ScanicPoint;
  bottomLeft: ScanicPoint;
}

export interface ScanicDetectResult {
  success: boolean;
  corners: ScanicCornerQuad | null;
  normalizedCorners: ScanicCornerQuad | null;
  confidence: number;
  width: number;
  height: number;
  durationMs: number;
  message: string;
}

export function initialize(): Promise<unknown>;
export function scanDocument(image: unknown, options?: Record<string, unknown>): Promise<any>;
export function extractDocument(image: unknown, corners: ScanicCornerQuad, options?: Record<string, unknown>): Promise<any>;
export function prepareScaleAndGrayscaleFromRgba(
  srcData: Uint8Array | Uint8ClampedArray,
  srcW: number,
  srcH: number,
  maxDim?: number
): {
  grayscaleData: Uint8ClampedArray;
  scaleFactor: number;
  originalDimensions: { width: number; height: number };
  scaledDimensions: { width: number; height: number };
};
export function normalizeCornerQuad(
  corners: ScanicCornerQuad | null | undefined,
  width: number,
  height: number
): ScanicCornerQuad | null;
export function detectEdgesFromRgba(
  rgbaData: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options?: Record<string, unknown>
): Promise<ScanicDetectResult>;
export class Scanner {
  constructor(options?: Record<string, unknown>);
  initialize(): Promise<void>;
  scan(image: unknown, options?: Record<string, unknown>): Promise<any>;
  extract(image: unknown, corners: ScanicCornerQuad, options?: Record<string, unknown>): Promise<any>;
}
