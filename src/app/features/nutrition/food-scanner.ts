export async function scanFood(
  video: HTMLVideoElement,
  signal: AbortSignal,
  onBarcode: (barcode: string) => void,
): Promise<void> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const { BarcodeFormat } = await import('@zxing/library');
  if (signal.aborted) return;
  const devices = navigator.mediaDevices;
  if (!devices) throw new Error('Camera access is unavailable.');
  const stream = await devices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' } },
  });
  const stopStream = () => stream.getTracks().forEach((track) => track.stop());
  if (signal.aborted) {
    stopStream();
    return;
  }

  let stopDecoder: (() => void) | undefined;
  const stop = () => {
    stopDecoder?.();
    stopStream();
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 160 });
    const controls = await reader.decodeFromStream(
      stream,
      video,
      (result, _error, scanControls) => {
        if (!result || signal.aborted) return;
        const text = result.getText();
        const code = result.getBarcodeFormat() === BarcodeFormat.UPC_E ? expandUpce(text) : text;
        if (!/^(?:\d{8}|\d{12,14})$/.test(code)) return;
        scanControls.stop();
        stopStream();
        onBarcode(code);
      },
    );
    stopDecoder = () => controls.stop();
    if (signal.aborted) stop();
  } catch (error) {
    stop();
    if (!signal.aborted) throw error;
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
