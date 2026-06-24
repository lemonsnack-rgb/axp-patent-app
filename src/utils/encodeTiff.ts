// encodeTiff.ts — 클라이언트 측 Baseline TIFF 인코더 (무압축 RGB, 의존성 없음)
//
// 특허 도면 제출 포맷(TIFF)을 위해 캔버스 픽셀을 표준 baseline TIFF로 직렬화한다.
// - 리틀엔디안(II), 무압축(Compression=1), RGB(PhotometricInterpretation=2, SamplesPerPixel=3)
// - 알파 채널은 흰 배경 위에 합성(flatten)하여 제거 → 특허 도면(흰 배경)에 적합
//
// 참고: 브라우저 canvas.toDataURL은 png/jpeg/webp만 지원하므로 TIFF는 직접 인코딩해야 한다.

const TYPE_SHORT = 3;
const TYPE_LONG = 4;
const TYPE_RATIONAL = 5;

interface Entry {
  tag: number;
  type: number;
  count: number;
  /** 4바이트 이내 즉시값(LONG/SHORT) 또는, 외부 데이터일 경우 그 오프셋 */
  value: number;
}

/**
 * ImageData(RGBA)를 무압축 Baseline TIFF(RGB) 바이트로 인코딩한다.
 * @param img        캔버스 getImageData 결과 (RGBA, 8bit/채널)
 * @param dpi        해상도(인치당 픽셀). 특허 도면 권장 300+ — 기본 300
 * @returns          TIFF 바이트(ArrayBuffer) — Blob/파일 저장에 바로 사용
 */
export function encodeTiff(img: ImageData, dpi = 300): ArrayBuffer {
  const { width: w, height: h, data } = img;
  const samplesPerPixel = 3; // RGB

  // ── 픽셀 데이터: RGBA → RGB(흰 배경 합성) ───────────────────────────────
  const pixelBytes = w * h * samplesPerPixel;
  const pixels = new Uint8Array(pixelBytes);
  for (let i = 0, p = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    // 흰 배경 위 합성: out = src*a + 255*(1-a)
    pixels[p++] = Math.round(data[i] * a + 255 * (1 - a));
    pixels[p++] = Math.round(data[i + 1] * a + 255 * (1 - a));
    pixels[p++] = Math.round(data[i + 2] * a + 255 * (1 - a));
  }

  // ── 레이아웃 오프셋 계산 ────────────────────────────────────────────────
  // 8(헤더) + IFD(2 + 12*entryCount + 4) + 외부데이터(BitsPerSample 6 + XRes 8 + YRes 8) + 픽셀
  const entryCount = 12;
  const ifdStart = 8;
  const ifdSize = 2 + 12 * entryCount + 4;
  const bitsPerSampleOffset = ifdStart + ifdSize;       // [8,8,8] (SHORT*3 = 6바이트)
  const xResOffset = bitsPerSampleOffset + 6;           // RATIONAL = 8바이트
  const yResOffset = xResOffset + 8;                    // RATIONAL = 8바이트
  const stripOffset = yResOffset + 8;                   // 픽셀 데이터 시작
  const total = stripOffset + pixelBytes;

  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const LE = true;

  // ── TIFF 헤더 ───────────────────────────────────────────────────────────
  dv.setUint8(0, 0x49); // 'I'
  dv.setUint8(1, 0x49); // 'I'  (little-endian)
  dv.setUint16(2, 42, LE); // 매직넘버
  dv.setUint32(4, ifdStart, LE); // 첫 IFD 오프셋

  // ── IFD 엔트리 (태그 오름차순 필수) ─────────────────────────────────────
  const entries: Entry[] = [
    { tag: 256, type: TYPE_LONG, count: 1, value: w },                    // ImageWidth
    { tag: 257, type: TYPE_LONG, count: 1, value: h },                    // ImageLength
    { tag: 258, type: TYPE_SHORT, count: 3, value: bitsPerSampleOffset }, // BitsPerSample [8,8,8]
    { tag: 259, type: TYPE_SHORT, count: 1, value: 1 },                   // Compression = none
    { tag: 262, type: TYPE_SHORT, count: 1, value: 2 },                   // Photometric = RGB
    { tag: 273, type: TYPE_LONG, count: 1, value: stripOffset },          // StripOffsets
    { tag: 277, type: TYPE_SHORT, count: 1, value: samplesPerPixel },     // SamplesPerPixel
    { tag: 278, type: TYPE_LONG, count: 1, value: h },                    // RowsPerStrip (단일 스트립)
    { tag: 279, type: TYPE_LONG, count: 1, value: pixelBytes },           // StripByteCounts
    { tag: 282, type: TYPE_RATIONAL, count: 1, value: xResOffset },       // XResolution
    { tag: 283, type: TYPE_RATIONAL, count: 1, value: yResOffset },       // YResolution
    { tag: 296, type: TYPE_SHORT, count: 1, value: 2 },                   // ResolutionUnit = inch
  ];

  dv.setUint16(ifdStart, entryCount, LE);
  entries.forEach((e, i) => {
    const off = ifdStart + 2 + i * 12;
    dv.setUint16(off, e.tag, LE);
    dv.setUint16(off + 2, e.type, LE);
    dv.setUint32(off + 4, e.count, LE);
    // 값 필드(4바이트): SHORT 단일값은 앞 2바이트에, 그 외(LONG/오프셋)는 4바이트
    if (e.type === TYPE_SHORT && e.count === 1) {
      dv.setUint16(off + 8, e.value, LE);
      dv.setUint16(off + 10, 0, LE);
    } else {
      dv.setUint32(off + 8, e.value, LE);
    }
  });
  // next IFD = 0
  dv.setUint32(ifdStart + 2 + entryCount * 12, 0, LE);

  // ── 외부 데이터 ─────────────────────────────────────────────────────────
  // BitsPerSample [8,8,8]
  dv.setUint16(bitsPerSampleOffset, 8, LE);
  dv.setUint16(bitsPerSampleOffset + 2, 8, LE);
  dv.setUint16(bitsPerSampleOffset + 4, 8, LE);
  // XResolution / YResolution (RATIONAL: 분자/분모)
  dv.setUint32(xResOffset, dpi, LE);
  dv.setUint32(xResOffset + 4, 1, LE);
  dv.setUint32(yResOffset, dpi, LE);
  dv.setUint32(yResOffset + 4, 1, LE);

  // ── 픽셀 데이터 ─────────────────────────────────────────────────────────
  u8.set(pixels, stripOffset);

  return buf;
}
