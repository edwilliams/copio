/**
 * Copio Client-Side OCR (Optical Character Recognition) Service
 * Powered by Tesseract.js WASM & Web Workers
 * 100% Private, Local, Offline-First Document Text Extraction
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'eng', label: 'English', flag: '🇬🇧' },
  { code: 'spa', label: 'Spanish (Español)', flag: '🇪🇸' },
  { code: 'fra', label: 'French (Français)', flag: '🇫🇷' },
  { code: 'deu', label: 'German (Deutsch)', flag: '🇩🇪' },
  { code: 'ita', label: 'Italian (Italiano)', flag: '🇮🇹' },
  { code: 'por', label: 'Portuguese (Português)', flag: '🇵🇹' },
  { code: 'nld', label: 'Dutch (Nederlands)', flag: '🇳🇱' },
  { code: 'pol', label: 'Polish (Polski)', flag: '🇵🇱' },
  { code: 'rus', label: 'Russian (Русский)', flag: '🇷🇺' },
  { code: 'chi_sim', label: 'Chinese Simplified (简体中文)', flag: '🇨🇳' },
  { code: 'chi_tra', label: 'Chinese Traditional (繁體中文)', flag: '🇹🇼' },
  { code: 'jpn', label: 'Japanese (日本語)', flag: '🇯🇵' },
  { code: 'kor', label: 'Korean (한국어)', flag: '🇰🇷' },
  { code: 'ara', label: 'Arabic (العربية)', flag: '🇸🇦' },
  { code: 'hin', label: 'Hindi (हिन्दी)', flag: '🇮🇳' },
  { code: 'tur', label: 'Turkish (Türkçe)', flag: '🇹🇷' },
  { code: 'vie', label: 'Vietnamese (Tiếng Việt)', flag: '🇻🇳' },
];

let activeWorker = null;
let currentWorkerLang = null;
let currentProgressCallback = null;

/**
 * Resolve the appropriate langPath:
 * - Local 'assets/tessdata' for pre-bundled English model
 * - Fast CDN for other languages (Tesseract automatically caches them in IndexedDB keyval-store for offline use)
 */
function getLangPath(lang) {
  if (lang === 'eng') {
    return 'assets/tessdata';
  }
  return 'https://tessdata.projectnaptha.com/4.0.0_fast';
}

/**
 * Format status message into user-friendly description
 */
function formatStatusMessage(status, progress = 0) {
  const percent = Math.round((progress || 0) * 100);
  switch (status) {
    case 'loading tesseract core':
      return 'Loading WebAssembly OCR engine...';
    case 'initializing tesseract':
      return 'Initializing OCR engine...';
    case 'loading language traineddata':
    case 'loaded language traineddata':
      return `Loading language data... ${percent > 0 ? percent + '%' : ''}`;
    case 'initializing api':
      return 'Preparing text recognition...';
    case 'recognizing text':
      return `Recognizing text... ${percent}%`;
    default:
      if (status && status.includes('recognizing')) {
        return `Recognizing text... ${percent}%`;
      }
      return status ? `${status.charAt(0).toUpperCase() + status.slice(1)}...` : 'Processing...';
  }
}

/**
 * Get or initialize Tesseract worker
 */
export async function getOcrWorker(lang = 'eng', onProgress = null) {
  currentProgressCallback = onProgress;

  if (activeWorker && currentWorkerLang === lang) {
    return activeWorker;
  }

  // If worker exists but for different language, terminate and re-create
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (e) {
      console.warn('Error terminating old OCR worker:', e);
    }
    activeWorker = null;
    currentWorkerLang = null;
  }

  if (typeof window.Tesseract === 'undefined') {
    throw new Error('Tesseract library is not loaded. Ensure tesseract.min.js is included.');
  }

  const langPath = getLangPath(lang);

  const worker = await window.Tesseract.createWorker(lang, 1, {
    workerPath: 'js/lib/tesseract-worker.min.js',
    corePath: 'js/lib/tesseract-core',
    langPath,
    logger: (message) => {
      if (currentProgressCallback && typeof currentProgressCallback === 'function') {
        const readableStatus = formatStatusMessage(message.status, message.progress);
        currentProgressCallback({
          status: message.status,
          progress: typeof message.progress === 'number' ? message.progress : 0,
          message: readableStatus,
          raw: message,
        });
      }
    },
  });

  activeWorker = worker;
  currentWorkerLang = lang;
  return activeWorker;
}

/**
 * Recognize text from a single image (Data URL, Blob, File, or Image element)
 * @param {string|Blob|File|HTMLImageElement|HTMLCanvasElement} image
 * @param {Object} options
 * @param {string} options.lang - Language code (e.g. 'eng', 'spa', 'fra')
 * @param {Function} options.onProgress - Progress callback ({ status, progress, message })
 * @returns {Promise<{ text: string, confidence: number, words: Array, lines: Array, paragraphs: Array }>}
 */
export async function recognizeImageText(image, options = {}) {
  const { lang = 'eng', onProgress = null } = options;

  if (onProgress) {
    onProgress({
      status: 'starting',
      progress: 0.05,
      message: 'Starting OCR engine...',
    });
  }

  const worker = await getOcrWorker(lang, onProgress);

  if (onProgress) {
    onProgress({
      status: 'recognizing text',
      progress: 0.2,
      message: 'Recognizing text...',
    });
  }

  const result = await worker.recognize(image);
  const data = result?.data || {};

  const cleanText = (data.text || '').trim();
  const confidence = Math.round(data.confidence || 0);

  if (onProgress) {
    onProgress({
      status: 'done',
      progress: 1,
      message: 'Text recognition complete!',
    });
  }

  return {
    text: cleanText,
    confidence,
    words: data.words || [],
    lines: data.lines || [],
    paragraphs: data.paragraphs || [],
    hocr: data.hocr || '',
  };
}

/**
 * Batch recognize text from multiple pages
 * @param {Array<{ id: string, src?: string, type?: string, content?: string, name?: string }>} pages
 * @param {Object} options
 * @param {string} options.lang
 * @param {Function} options.onPageProgress - ({ pageIndex, totalPages, pageProgress, overallProgress, message })
 * @returns {Promise<{ pagesResults: Array, combinedText: string, averageConfidence: number }>}
 */
export async function recognizeDocumentPages(pages, options = {}) {
  const { lang = 'eng', onPageProgress = null } = options;
  const imagePages = (pages || []).filter((p) => p.type !== 'markdown' && p.src);

  if (imagePages.length === 0) {
    return {
      pagesResults: [],
      combinedText: '',
      averageConfidence: 0,
    };
  }

  const results = [];
  let totalConfidence = 0;

  for (let i = 0; i < imagePages.length; i++) {
    const page = imagePages[i];
    const pageNum = i + 1;
    const total = imagePages.length;

    const pageResult = await recognizeImageText(page.src, {
      lang,
      onProgress: (p) => {
        if (onPageProgress) {
          const overallProgress = (i + (p.progress || 0)) / total;
          onPageProgress({
            pageIndex: i,
            pageNumber: pageNum,
            totalPages: total,
            pageProgress: p.progress || 0,
            overallProgress,
            message: `Page ${pageNum} of ${total}: ${p.message}`,
          });
        }
      },
    });

    results.push({
      pageId: page.id,
      pageIndex: i,
      pageNumber: pageNum,
      ...pageResult,
    });

    totalConfidence += pageResult.confidence;
  }

  const combinedText = results
    .map((r) => (results.length > 1 ? `## Page ${r.pageNumber}\n\n${r.text}` : r.text))
    .join('\n\n---\n\n');

  const averageConfidence = Math.round(totalConfidence / results.length);

  return {
    pagesResults: results,
    combinedText,
    averageConfidence,
  };
}

/**
 * Terminate active worker to release memory
 */
export async function terminateOcrWorker() {
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch (err) {
      console.warn('Error during OCR worker termination:', err);
    }
    activeWorker = null;
    currentWorkerLang = null;
    currentProgressCallback = null;
  }
}
