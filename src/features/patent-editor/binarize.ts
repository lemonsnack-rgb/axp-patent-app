const THRESHOLD = 128;

export async function binarizeCanvasToBlob(
  sourceCanvas: HTMLCanvasElement,
): Promise<Blob> {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const srcCtx = sourceCanvas.getContext("2d");
  if (!srcCtx) throw new Error("2D context unavailable on source canvas.");

  const imageData = srcCtx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    let luminance: number;
    if (alpha < 255) {
      const a = alpha / 255;
      const r = data[i] * a + 255 * (1 - a);
      const g = data[i + 1] * a + 255 * (1 - a);
      const b = data[i + 2] * a + 255 * (1 - a);
      luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    } else {
      luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    const v = luminance < THRESHOLD ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("2D context unavailable on output canvas.");
  outCtx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("toBlob() returned null."));
    }, "image/png");
  });
}
