/**
 * Cropper.js Styles Encapsulated Module (CPO-032)
 * Embeds Cropper.js v1.3.2 stylesheet for Shadow DOM usage, eliminating external CSS links.
 */

export const cropperCss = `
.cropper-container {
  direction: ltr;
  font-size: 0;
  line-height: 0;
  position: relative;
  -ms-touch-action: none;
  touch-action: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

.cropper-container img {
  display: block;
  height: 100%;
  image-orientation: 0deg;
  max-height: none !important;
  max-width: none !important;
  min-height: 0 !important;
  min-width: 0 !important;
  width: 100%;
}

.cropper-wrap-box,
.cropper-canvas,
.cropper-drag-box,
.cropper-crop-box,
.cropper-modal {
  bottom: 0;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
}

.cropper-wrap-box,
.cropper-canvas {
  overflow: hidden;
}

.cropper-drag-box {
  background-color: #fff;
  opacity: 0;
}

.cropper-modal {
  background-color: #000;
  opacity: 0.5;
}

.cropper-view-box {
  display: block;
  height: 100%;
  outline-color: rgba(51, 153, 255, 0.75);
  outline: 1px solid #39f;
  overflow: hidden;
  width: 100%;
}

.cropper-dashed {
  border: 0 dashed #eee;
  display: block;
  opacity: 0.5;
  position: absolute;
}

.cropper-dashed.dashed-h {
  border-bottom-width: 1px;
  border-top-width: 1px;
  height: 33.33333%;
  left: 0;
  top: 33.33333%;
  width: 100%;
}

.cropper-dashed.dashed-v {
  border-left-width: 1px;
  border-right-width: 1px;
  height: 100%;
  left: 33.33333%;
  top: 0;
  width: 33.33333%;
}

.cropper-center {
  display: block;
  height: 0;
  left: 50%;
  opacity: 0.75;
  position: absolute;
  top: 50%;
  width: 0;
}

.cropper-center:before,
.cropper-center:after {
  background-color: #eee;
  content: ' ';
  display: block;
  position: absolute;
}

.cropper-center:before {
  height: 1px;
  left: -3px;
  top: 0;
  width: 7px;
}

.cropper-center:after {
  height: 7px;
  left: 0;
  top: -3px;
  width: 1px;
}

.cropper-face,
.cropper-line,
.cropper-point {
  display: block;
  height: 100%;
  opacity: 0.1;
  position: absolute;
  width: 100%;
}

.cropper-face {
  background-color: #fff;
  left: 0;
  top: 0;
}

.cropper-line {
  background-color: #39f;
}

.cropper-line.line-e {
  cursor: ew-resize;
  right: -3px;
  top: 0;
  width: 5px;
}

.cropper-line.line-n {
  cursor: ns-resize;
  height: 5px;
  left: 0;
  top: -3px;
}

.cropper-line.line-w {
  cursor: ew-resize;
  left: -3px;
  top: 0;
  width: 5px;
}

.cropper-line.line-s {
  bottom: -3px;
  cursor: ns-resize;
  height: 5px;
  left: 0;
}

.cropper-point {
  width: var(--copio-crop-handle-hit, 48px);
  height: var(--copio-crop-handle-hit, 48px);
  min-width: 44px;
  min-height: 44px;
  background-color: transparent;
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  touch-action: none;
  z-index: 10;
}

.cropper-point::after {
  content: '';
  display: block;
  width: var(--copio-crop-handle-visual, 16px);
  height: var(--copio-crop-handle-visual, 16px);
  border-radius: 50%;
  background-color: var(--copio-color-primary, #38bdf8);
  border: 2.5px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
  transition: transform 120ms ease;
  box-sizing: border-box;
}

.cropper-point:hover::after,
.cropper-point:active::after {
  transform: scale(1.25);
  background-color: var(--copio-color-success, #22c55e);
}

.cropper-point.point-e {
  cursor: ew-resize;
  margin-top: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  right: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  top: 50%;
}

.cropper-point.point-n {
  cursor: ns-resize;
  left: 50%;
  margin-left: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  top: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
}

.cropper-point.point-w {
  cursor: ew-resize;
  left: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  margin-top: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  top: 50%;
}

.cropper-point.point-s {
  bottom: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  cursor: s-resize;
  left: 50%;
  margin-left: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
}

.cropper-point.point-ne {
  cursor: nesw-resize;
  right: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  top: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
}

.cropper-point.point-nw {
  cursor: nwse-resize;
  left: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  top: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
}

.cropper-point.point-sw {
  bottom: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  cursor: nesw-resize;
  left: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
}

.cropper-point.point-se {
  bottom: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
  cursor: nwse-resize;
  right: calc(-1 * var(--copio-crop-handle-hit, 48px) / 2);
}

.cropper-invisible {
  opacity: 0;
}

.cropper-bg {
  background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAAA3NCSVQICAjb4U/gAAAABlBMVEXMzMz////TjRV2AAAACXBIWXMAAArrAAAK6wGCiw1aAAAAHHRFWHRTb2Z0d2FyZQBBZG9iZSBGaXJld29ya3MgQ1M26LyyjAAAABFJREFUCJlj+M/AgBVhF/0PAH6/D/HkDxOGAAAAAElFTkSuQmCC');
}

.cropper-hide {
  display: block;
  height: 0;
  position: absolute;
  width: 0;
}

.cropper-hidden {
  display: none !important;
}

.cropper-move {
  cursor: move;
}

.cropper-crop {
  cursor: crosshair;
}

.cropper-disabled .cropper-drag-box,
.cropper-disabled .cropper-face,
.cropper-disabled .cropper-line,
.cropper-disabled .cropper-point {
  cursor: not-allowed;
}
`;
