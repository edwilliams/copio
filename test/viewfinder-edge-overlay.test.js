import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import {
  COPIO_EVENTS,
  quadToCropRect,
  EdgeDetectorPort,
} from '../sdk/index.js';

function createMockCameraStream(width = 640, height = 480) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(100, 80, 440, 320);

  let stream;
  if (typeof canvas.captureStream === 'function') {
    stream = canvas.captureStream(30);
  } else {
    let active = true;
    const fakeTrack = {
      kind: 'video',
      get readyState() { return active ? 'live' : 'ended'; },
      stop() { active = false; },
    };
    stream = {
      getTracks: () => [fakeTrack],
      getVideoTracks: () => [fakeTrack],
    };
  }
  return stream;
}

class MockEdgeDetectorAdapter extends EdgeDetectorPort {
  constructor(detectionResult = null) {
    super();
    this.customResult = detectionResult || {
      quad: {
        topLeft: { x: 0.15, y: 0.12 },
        topRight: { x: 0.85, y: 0.14 },
        bottomRight: { x: 0.82, y: 0.88 },
        bottomLeft: { x: 0.18, y: 0.85 },
      },
      confidence: 0.85,
      durationMs: 12,
      isFallback: false,
    };
    this.calls = 0;
  }

  async detect(source, options = {}) {
    this.calls++;
    if (typeof this.customResult === 'function') {
      return this.customResult(source, options);
    }
    return this.customResult;
  }
}

describe('CPO-076: Auto edge detection — live viewfinder quad overlay & pre-filled crop', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-viewfinder-quad-fixture';
    container.style.width = '640px';
    container.style.height = '480px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Live SVG Quad Overlay DOM & Attributes', () => {
    it('initializes overlay SVG element inside #camera-feed', () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);
      const shadow = scanner.shadowRoot;

      const overlay = shadow.querySelector('#live-quad-overlay');
      const polygon = shadow.querySelector('#live-quad-polygon');
      const feed = shadow.querySelector('#camera-feed');

      expect(overlay).to.exist;
      expect(polygon).to.exist;
      expect(feed).to.exist;
      expect(overlay.getAttribute('aria-hidden')).to.equal('true');
      expect(scanner.edgeDetection).to.be.true;
      expect(scanner.autoCrop).to.be.true;
      expect(scanner.autoCapture).to.be.false;
    });

    it('reflects edge-detection, auto-crop, and auto-capture attributes and properties', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('edge-detection', 'false');
      scanner.setAttribute('auto-crop', 'false');
      scanner.setAttribute('auto-capture', 'true');
      container.appendChild(scanner);

      expect(scanner.edgeDetection).to.be.false;
      expect(scanner.autoCrop).to.be.false;
      expect(scanner.autoCapture).to.be.true;

      scanner.edgeDetection = true;
      expect(scanner.getAttribute('edge-detection')).to.equal('true');

      scanner.autoCrop = true;
      expect(scanner.getAttribute('auto-crop')).to.equal('true');

      scanner.autoCapture = false;
      expect(scanner.getAttribute('auto-capture')).to.equal('false');
    });

    it('converts quad coordinates to normalized bounding box with quadToCropRect', () => {
      const quad = {
        topLeft: { x: 0.1, y: 0.2 },
        topRight: { x: 0.9, y: 0.25 },
        bottomRight: { x: 0.85, y: 0.8 },
        bottomLeft: { x: 0.15, y: 0.75 },
      };
      const rect = quadToCropRect(quad);
      expect(rect.x).to.be.closeTo(0.1, 0.001);
      expect(rect.y).to.be.closeTo(0.2, 0.001);
      expect(rect.w).to.be.closeTo(0.8, 0.001);
      expect(rect.h).to.be.closeTo(0.6, 0.001);
    });
  });

  describe('Live Quad Tracking & Overlay Rendering', () => {
    it('dispatches copio:edge-detected and renders polygon on active viewfinder frames', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      const mockAdapter = new MockEdgeDetectorAdapter();
      scanner.engine.setService('edge', mockAdapter);

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      // Listen for copio:edge-detected event
      const eventPromise = new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.EDGE_DETECTED, (e) => {
          resolve(e.detail);
        }, { once: true });
      });

      const detail = await eventPromise;
      expect(detail).to.exist;
      expect(detail.confidence).to.equal(0.85);
      expect(detail.quad).to.exist;
      expect(detail.quad.topLeft.x).to.be.closeTo(0.15, 0.05);

      const shadow = scanner.shadowRoot;
      const overlay = shadow.querySelector('#live-quad-overlay');
      const polygon = shadow.querySelector('#live-quad-polygon');
      const feed = shadow.querySelector('#camera-feed');

      expect(overlay.style.display).to.equal('block');
      expect(feed.classList.contains('is-tracking')).to.be.true;
      expect(feed.classList.contains('is-detected')).to.be.true;
      expect(polygon.getAttribute('points')).to.not.be.empty;

      const liveQuad = scanner.getLiveQuad();
      expect(liveQuad).to.exist;
      expect(liveQuad.topLeft.x).to.be.closeTo(0.15, 0.05);

      const latest = scanner.getLatestDetection();
      expect(latest).to.exist;
      expect(latest.confidence).to.equal(0.85);
      expect(latest.isFallback).to.be.false;

      scanner.close();
    });

    it('smoothes quad coordinates across frames with EMA factor', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      let step = 0;
      const mockAdapter = new MockEdgeDetectorAdapter((_source, _opts) => {
        step++;
        if (step === 1) {
          return {
            quad: {
              topLeft: { x: 0.1, y: 0.1 },
              topRight: { x: 0.9, y: 0.1 },
              bottomRight: { x: 0.9, y: 0.9 },
              bottomLeft: { x: 0.1, y: 0.9 },
            },
            confidence: 0.9,
            durationMs: 10,
            isFallback: false,
          };
        }
        return {
          quad: {
            topLeft: { x: 0.3, y: 0.3 },
            topRight: { x: 0.7, y: 0.3 },
            bottomRight: { x: 0.7, y: 0.7 },
            bottomLeft: { x: 0.3, y: 0.7 },
          },
          confidence: 0.9,
          durationMs: 10,
          isFallback: false,
        };
      });
      scanner.engine.setService('edge', mockAdapter);

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      // Wait for at least 2 frames
      let frameCount = 0;
      await new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.EDGE_DETECTED, () => {
          frameCount++;
          if (frameCount >= 2) resolve();
        });
      });

      const smoothed = scanner.getLiveQuad();
      expect(smoothed).to.exist;
      // Step 1: 0.1. Step 2 raw: 0.3. EMA with alpha=0.35: 0.35 * 0.3 + 0.65 * 0.1 = 0.17
      expect(smoothed.topLeft.x).to.be.greaterThan(0.10);
      expect(smoothed.topLeft.x).to.be.lessThan(0.28);

      scanner.close();
    });

    it('hides overlay and clears tracking when edge detection is disabled or on consecutive misses', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      const mockAdapter = new MockEdgeDetectorAdapter();
      scanner.engine.setService('edge', mockAdapter);

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      await new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.EDGE_DETECTED, resolve, { once: true });
      });

      expect(scanner.getLiveQuad()).to.exist;

      // Disable edge detection
      scanner.edgeDetection = false;
      expect(scanner.getLiveQuad()).to.be.null;

      const shadow = scanner.shadowRoot;
      const overlay = shadow.querySelector('#live-quad-overlay');
      const feed = shadow.querySelector('#camera-feed');
      expect(overlay.style.display).to.equal('none');
      expect(feed.classList.contains('is-tracking')).to.be.false;

      scanner.close();
    });
  });

  describe('Pre-filled Crop On Shutter Snapshot', () => {
    it('pre-fills crop and stores detected quad in edits when capturing via shutter', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'single');
      container.appendChild(scanner);

      const targetQuad = {
        topLeft: { x: 0.2, y: 0.15 },
        topRight: { x: 0.8, y: 0.18 },
        bottomRight: { x: 0.78, y: 0.82 },
        bottomLeft: { x: 0.22, y: 0.80 },
      };

      const mockAdapter = new MockEdgeDetectorAdapter({
        quad: targetQuad,
        confidence: 0.88,
        durationMs: 15,
        isFallback: false,
      });
      scanner.engine.setService('edge', mockAdapter);

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      // Wait for detection to stabilize
      await new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.EDGE_DETECTED, resolve, { once: true });
      });

      const pagePromise = new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => resolve(e.detail), { once: true });
      });

      // Click shutter button
      const shutterBtn = scanner.shadowRoot.querySelector('#btn-shutter');
      shutterBtn.click();

      const detail = await pagePromise;
      expect(detail).to.exist;
      expect(detail.page).to.exist;
      expect(detail.page.edits).to.exist;
      expect(detail.page.edits.quad).to.exist;
      expect(detail.page.edits.crop).to.exist;

      // Crop coordinates should match quadToCropRect(targetQuad) within EMA tolerance
      const expectedRect = quadToCropRect(targetQuad);
      expect(detail.page.edits.crop.x).to.be.closeTo(expectedRect.x, 0.05);
      expect(detail.page.edits.crop.y).to.be.closeTo(expectedRect.y, 0.05);
      expect(detail.page.edits.crop.w).to.be.closeTo(expectedRect.w, 0.05);
      expect(detail.page.edits.crop.h).to.be.closeTo(expectedRect.h, 0.05);

      scanner.close();
    });
  });

  describe('Smart Shutter Auto-Capture', () => {
    it('triggers automatic capture when autoCapture is true and quad is stable', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('auto-capture', 'true');
      container.appendChild(scanner);

      const stableQuad = {
        topLeft: { x: 0.15, y: 0.15 },
        topRight: { x: 0.85, y: 0.15 },
        bottomRight: { x: 0.85, y: 0.85 },
        bottomLeft: { x: 0.15, y: 0.85 },
      };

      const mockAdapter = new MockEdgeDetectorAdapter({
        quad: stableQuad,
        confidence: 0.85,
        durationMs: 10,
        isFallback: false,
      });
      scanner.engine.setService('edge', mockAdapter);

      const pagePromise = new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, (e) => resolve(e.detail), { once: true });
      });

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      // Should automatically snap without manual shutter click
      const detail = await pagePromise;
      expect(detail).to.exist;
      expect(detail.page).to.exist;
      expect(detail.page.edits.quad).to.exist;

      scanner.close();
    });
  });

  describe('detectCurrentFrame API', () => {
    it('allows imperative frame detection via detectCurrentFrame()', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      const mockAdapter = new MockEdgeDetectorAdapter({
        quad: {
          topLeft: { x: 0.05, y: 0.05 },
          topRight: { x: 0.95, y: 0.05 },
          bottomRight: { x: 0.95, y: 0.95 },
          bottomLeft: { x: 0.05, y: 0.95 },
        },
        confidence: 0.92,
        durationMs: 8,
        isFallback: false,
      });
      scanner.engine.setService('edge', mockAdapter);

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      const result = await scanner.detectCurrentFrame({ maxProcessingDimension: 320 });
      expect(result).to.exist;
      expect(result.confidence).to.equal(0.92);
      expect(result.quad.topRight.x).to.equal(0.95);

      scanner.close();
    });
  });

  describe('Edge Model Backend Configuration (Classical WASM vs ML Neural)', () => {
    it('defaults edgeModel to "classical" and synchronizes "edge-model" attribute', async () => {
      const scanner = document.createElement('copio-scanner');
      container.appendChild(scanner);

      expect(scanner.edgeModel).to.equal('classical');
      scanner.edgeModel = 'ml';
      expect(scanner.getAttribute('edge-model')).to.equal('ml');

      scanner.setAttribute('edge-model', 'classical');
      expect(scanner.edgeModel).to.equal('classical');

      scanner.close();
    });

    it('passes configured detector backend ("ml") to the edge detector during frame processing', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('edge-model', 'ml');
      container.appendChild(scanner);

      let capturedDetectorOption = null;
      const trackingAdapter = {
        async detect(_image, options) {
          capturedDetectorOption = options.detector;
          return {
            quad: {
              topLeft: { x: 0.1, y: 0.1 },
              topRight: { x: 0.9, y: 0.1 },
              bottomRight: { x: 0.9, y: 0.9 },
              bottomLeft: { x: 0.1, y: 0.9 },
            },
            confidence: 0.95,
            isFallback: false,
          };
        },
      };
      scanner.engine.setService('edge', trackingAdapter);

      const stream = createMockCameraStream(640, 480);
      scanner.setCameraStream(stream);

      // Wait for edge-detected event to confirm frame was processed with 'ml'
      await new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.EDGE_DETECTED, resolve, { once: true });
      });

      expect(capturedDetectorOption).to.equal('ml');
      scanner.close();
    });
  });
});
