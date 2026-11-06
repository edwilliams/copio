import { expect } from '@esm-bundle/chai';
import '../sdk/index.js';
import { COPIO_EVENTS } from '../sdk/events.js';

function createMockCameraStream(width = 1280, height = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(50, 50, width - 100, 100);

  let stream;
  if (typeof canvas.captureStream === 'function') {
    stream = canvas.captureStream(25);
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

describe('CPO-072: Batch Capture Hardening, Device Verification & Camera Lifecycle', () => {
  let fixtureContainer;

  beforeEach(() => {
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'batch-test-fixture';
    document.body.appendChild(fixtureContainer);
  });

  afterEach(() => {
    fixtureContainer.remove();
  });

  describe('Continuous 10-Page Batch Capture (No Viewfinder Exit)', () => {
    it('captures 10 pages in succession while keeping camera stream alive and in viewfinder stage', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'batch');
      scanner.setAttribute('aspect', 'a4');
      fixtureContainer.appendChild(scanner);

      const stream = createMockCameraStream();
      scanner.setCameraStream(stream);

      const shadow = scanner.shadowRoot;
      const videoEl = shadow.querySelector('#camera-video');
      expect(videoEl).to.exist;
      expect(videoEl.style.display).to.equal('block');
      expect(scanner._isCameraActive()).to.be.true;

      const btnShutter = shadow.querySelector('#btn-shutter');
      const stepPillText = shadow.querySelector('#step-pill-text');
      const reviewBtn = shadow.querySelector('#btn-review');
      const reviewText = shadow.querySelector('#review-pill-text');

      // Snap 10 pages consecutively without leaving viewfinder
      for (let i = 1; i <= 10; i++) {
        const pageAddedPromise = new Promise((resolve) => {
          scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, resolve, { once: true });
        });
        btnShutter.click();
        await pageAddedPromise;

        // Camera must remain active after every single snap in batch mode
        expect(scanner._isCameraActive(), `Camera active on page ${i}`).to.be.true;
        expect(scanner.stage, `Stage on page ${i}`).to.equal('viewfinder');

        // Review pill and step pill reflect the running count
        expect(reviewBtn.style.display).to.not.equal('none');
        expect(reviewText.textContent).to.equal(`Review (${i}) →`);
        expect(stepPillText.textContent).to.equal(`Batch Capture · Page ${i + 1}`);
      }

      const pages = await scanner.getPages();
      expect(pages).to.have.lengthOf(10);

      // Now switch to workbench to review
      reviewBtn.click();
      await new Promise((r) => setTimeout(r, 30));

      expect(scanner.stage).to.equal('workbench');
      // Transitioning to workbench must stop the camera stream
      expect(scanner._isCameraActive()).to.be.false;

      // Verify all 10 pages rendered in filmstrip
      const filmstripItems = shadow.querySelectorAll('.copio-filmstrip-item');
      expect(filmstripItems).to.have.lengthOf(10);

      // Verify complete scan CTA shows 10 pages
      const primaryCta = shadow.querySelector('#btn-primary-complete');
      expect(primaryCta.textContent).to.include('10 Pages');
    });

    it('stops camera and transitions to workbench when maxPages cap is reached in batch mode', async () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'batch');
      scanner.setAttribute('max-pages', '2');
      fixtureContainer.appendChild(scanner);

      const stream = createMockCameraStream();
      scanner.setCameraStream(stream);

      const shadow = scanner.shadowRoot;
      const btnShutter = shadow.querySelector('#btn-shutter');

      // First snap
      const p1 = new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, resolve, { once: true });
      });
      btnShutter.click();
      await p1;

      expect(scanner.stage).to.equal('viewfinder');
      expect(scanner._isCameraActive()).to.be.true;

      // Second snap (reaches max-pages 2)
      const p2 = new Promise((resolve) => {
        scanner.addEventListener(COPIO_EVENTS.PAGE_ADDED, resolve, { once: true });
      });
      btnShutter.click();
      await p2;
      await new Promise((r) => setTimeout(r, 30));

      expect(scanner.stage).to.equal('workbench');
      expect(scanner._isCameraActive()).to.be.false;
      const pages = await scanner.getPages();
      expect(pages).to.have.lengthOf(2);
    });
  });

  describe('Camera Lifecycle & Fast Indicator Shutdown (Under 1s)', () => {
    it('stops stream tracks immediately on scanner.close()', () => {
      const scanner = document.createElement('copio-scanner');
      scanner.setAttribute('mode', 'batch');
      fixtureContainer.appendChild(scanner);

      const stream = createMockCameraStream();
      let stopCount = 0;
      stream.getTracks().forEach((track) => {
        const orig = track.stop.bind(track);
        track.stop = () => {
          stopCount++;
          orig();
        };
      });

      scanner.setCameraStream(stream);
      expect(scanner._isCameraActive()).to.be.true;

      const startTime = performance.now();
      scanner.close();
      const elapsedMs = performance.now() - startTime;

      expect(elapsedMs).to.be.below(1000);
      expect(scanner._isCameraActive()).to.be.false;
      expect(stopCount).to.be.at.least(1);
    });

    it('stops stream tracks immediately on disconnect (removed from DOM)', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const stream = createMockCameraStream();
      let stopCount = 0;
      stream.getTracks().forEach((track) => {
        const orig = track.stop.bind(track);
        track.stop = () => {
          stopCount++;
          orig();
        };
      });

      scanner.setCameraStream(stream);
      expect(scanner._isCameraActive()).to.be.true;

      scanner.remove();
      expect(scanner._isCameraActive()).to.be.false;
      expect(stopCount).to.be.at.least(1);
    });

    it('stops stream immediately on tab hide (document visibilitychange: hidden)', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const stream = createMockCameraStream();
      let stopCount = 0;
      stream.getTracks().forEach((track) => {
        const orig = track.stop.bind(track);
        track.stop = () => {
          stopCount++;
          orig();
        };
      });

      scanner.setCameraStream(stream);
      expect(scanner._isCameraActive()).to.be.true;

      // Mock tab hiding
      const origVisibility = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
      try {
        Object.defineProperty(Document.prototype, 'visibilityState', {
          get: () => 'hidden',
          configurable: true,
        });

        document.dispatchEvent(new Event('visibilitychange'));
        expect(scanner._isCameraActive()).to.be.false;
        expect(stopCount).to.be.at.least(1);
      } finally {
        if (origVisibility) {
          Object.defineProperty(Document.prototype, 'visibilityState', origVisibility);
        }
      }
    });
  });

  describe('Fallback to Native File Input with Toast', () => {
    let origMediaDevices;

    beforeEach(() => {
      origMediaDevices = navigator.mediaDevices;
    });

    afterEach(() => {
      if (origMediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: origMediaDevices,
          configurable: true,
          writable: true,
        });
      }
    });

    it('displays warning toast and falls back to file picker on NotAllowedError (permission denied)', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      // Mock getUserMedia rejecting with NotAllowedError
      const deniedErr = new Error('Permission denied');
      deniedErr.name = 'NotAllowedError';
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => { throw deniedErr; },
        },
        configurable: true,
        writable: true,
      });

      let errorEventDetail = null;
      scanner.addEventListener(COPIO_EVENTS.ERROR, (e) => {
        errorEventDetail = e.detail;
      });

      const shadow = scanner.shadowRoot;
      const fileInput = shadow.querySelector('#internal-file-input');
      let fileInputClicked = false;
      fileInput.click = () => {
        fileInputClicked = true;
      };

      await scanner.startCamera({ force: true });

      expect(fileInputClicked).to.be.true;
      expect(errorEventDetail).to.exist;
      expect(errorEventDetail.code).to.equal('CAMERA_PERMISSION_DENIED');

      const toast = shadow.querySelector('.copio-toast-warning');
      expect(toast).to.exist;
      expect(toast.textContent).to.include('Camera permission denied');
    });

    it('displays warning toast and falls back to file picker on NotFoundError (no camera hardware)', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const notFoundErr = new Error('No camera found');
      notFoundErr.name = 'NotFoundError';
      Object.defineProperty(navigator, 'mediaDevices', {
        value: {
          getUserMedia: async () => { throw notFoundErr; },
        },
        configurable: true,
        writable: true,
      });

      let errorEventDetail = null;
      scanner.addEventListener(COPIO_EVENTS.ERROR, (e) => {
        errorEventDetail = e.detail;
      });

      const shadow = scanner.shadowRoot;
      const fileInput = shadow.querySelector('#internal-file-input');
      let fileInputClicked = false;
      fileInput.click = () => {
        fileInputClicked = true;
      };

      await scanner.startCamera({ force: true });

      expect(fileInputClicked).to.be.true;
      expect(errorEventDetail).to.exist;
      expect(errorEventDetail.code).to.equal('CAMERA_UNAVAILABLE');

      const toast = shadow.querySelector('.copio-toast-warning');
      expect(toast).to.exist;
      expect(toast.textContent).to.include('Camera unavailable');
    });
  });

  describe('Internal Viewfinder Frame-Grab Hook (_grabFrame)', () => {
    it('returns null when camera stream is not active', () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      expect(scanner._grabFrame()).to.be.null;
    });

    it('grabs downscaled ImageData and Canvas from live camera video for edge detection (CPO-074)', async () => {
      const scanner = document.createElement('copio-scanner');
      fixtureContainer.appendChild(scanner);

      const stream = createMockCameraStream(1920, 1080);
      scanner.setCameraStream(stream);

      const shadow = scanner.shadowRoot;
      const videoEl = shadow.querySelector('#camera-video');
      await videoEl.play().catch(() => {});

      // Frame grab as ImageData (default)
      const frameData = scanner._grabFrame({ maxWidth: 640, maxHeight: 480 });
      expect(frameData).to.exist;
      expect(frameData.width).to.be.at.most(640);
      expect(frameData.height).to.be.at.most(480);
      expect(frameData.data).to.be.instanceOf(Uint8ClampedArray);

      // Frame grab as canvas element
      const frameCanvas = scanner._grabFrame({ maxWidth: 320, maxHeight: 240, format: 'canvas' });
      expect(frameCanvas).to.exist;
      expect(frameCanvas.width).to.be.at.most(320);
      expect(frameCanvas.height).to.be.at.most(240);

      scanner.stopCamera();
      expect(scanner._grabFrame()).to.be.null;
    });
  });
});
