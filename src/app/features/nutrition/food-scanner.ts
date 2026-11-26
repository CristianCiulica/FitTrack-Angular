import type { DecodeHintType as HintType } from '@zxing/library';
import { barcodePattern } from './nutrition-math';

export function scannerCrop(video: HTMLVideoElement, frame: HTMLElement) {
  const preview = video.getBoundingClientRect();
  const guide = frame.getBoundingClientRect();
  if (!preview.width || !preview.height || !video.videoWidth || !video.videoHeight) return null;

  // Reverse object-fit: cover so decoding uses the same part of the camera image as the guide.
  const scale = Math.max(preview.width / video.videoWidth, preview.height / video.videoHeight);
  const offsetX = (video.videoWidth - preview.width / scale) / 2;
  const offsetY = (video.videoHeight - preview.height / scale) / 2;
  const margin = guide.width * 0.06;
  const x = Math.max(0, offsetX + (guide.left - preview.left - margin) / scale);
  const y = Math.max(0, offsetY + (guide.top - preview.top) / scale);
  const width = Math.min(video.videoWidth - x, (guide.width + 2 * margin) / scale);
  const height = Math.min(video.videoHeight - y, guide.height / scale);
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

export async function scanFood(
  video: HTMLVideoElement,
  frame: HTMLElement,
  signal: AbortSignal,
  onBarcode: (barcode: string) => void,
): Promise<void> {
  const [
    { BrowserMultiFormatReader },
    { BarcodeFormat, DecodeHintType, NotFoundException, ChecksumException, FormatException },
  ] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  if (signal.aborted) return;
  if (!navigator.mediaDevices) throw new Error('Camera access is unavailable.');
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  const stop = () => {
    stream.getTracks().forEach((track) => track.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    if (signal.aborted) return;

    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODE_128,
    ];
    const reader = new BrowserMultiFormatReader(
      new Map<HintType, unknown>([
        [DecodeHintType.POSSIBLE_FORMATS, formats],
        [DecodeHintType.TRY_HARDER, true],
      ]),
    );
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Barcode scanning is unavailable.');

    video.srcObject = stream;
    await video.play();
    while (!signal.aborted) {
      const crop = scannerCrop(video, frame);
      if (crop && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const scale = Math.min(1, 960 / crop.width);
        const width = Math.max(1, Math.round(crop.width * scale));
        const height = Math.max(1, Math.round(crop.height * scale));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        context.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
        try {
          const result = reader.decodeFromCanvas(canvas);
          const text = result.getText();
          const code = result.getBarcodeFormat() === BarcodeFormat.UPC_E ? expandUpce(text) : text;
          if (barcodePattern.test(code)) {
            stop();
            onBarcode(code);
            return;
          }
        } catch (error) {
          if (
            !(
              error instanceof NotFoundException ||
              error instanceof ChecksumException ||
              error instanceof FormatException
            )
          )
            throw error;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 160));
    }
  } finally {
    signal.removeEventListener('abort', stop);
    stop();
  }
}

export function expandUpce(code: string): string {
  if (!/^\d{8}$/.test(code)) return code;
  const [system, first, second, third, fourth, fifth, type, check] = code;
  if (type <= '2') return `${system}${first}${second}${type}0000${third}${fourth}${fifth}${check}`;
  if (type === '3') return `${system}${first}${second}${third}00000${fourth}${fifth}${check}`;
  if (type === '4') return `${system}${first}${second}${third}${fourth}00000${fifth}${check}`;
  return `${system}${first}${second}${third}${fourth}${fifth}0000${type}${check}`;
}
