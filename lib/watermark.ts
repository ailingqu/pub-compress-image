import sharp from 'sharp';

export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'tile';

export type OutputFormat = 'webp' | 'jpeg' | 'png';

export interface WatermarkOptions {
  type: 'image' | 'text';
  watermarkBuffer?: Buffer;
  text?: string;
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  margin: number;
  fontSize?: number;
  color: string;
  format: OutputFormat;
  quality: number;
}

export interface ParsedBaseOptions {
  type: 'image' | 'text';
  text?: string;
  position: WatermarkPosition;
  opacity: number;
  scale: number;
  margin: number;
  fontSize?: number;
  color: string;
  format: OutputFormat;
  quality: number;
}

const VALID_POSITIONS: ReadonlySet<WatermarkPosition> = new Set([
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
  'tile',
]);

const VALID_FORMATS: ReadonlySet<OutputFormat> = new Set(['webp', 'jpeg', 'png']);

const IMAGE_EXT_REGEX = /\.(jpe?g|png|gif|webp|tiff?|bmp|avif|heic|heif|svg)$/i;

export function looksLikeImage(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  if (!file.type || file.type === 'application/octet-stream') {
    return IMAGE_EXT_REGEX.test(file.name || '');
  }
  return false;
}

export function parseBaseOptions(
  formData: FormData,
  hasWatermarkFile: boolean
): { ok: true; options: ParsedBaseOptions } | { ok: false; error: string } {
  const text = (formData.get('text') as string | null)?.trim() || undefined;
  const type: 'image' | 'text' = hasWatermarkFile ? 'image' : 'text';

  if (type === 'text' && !text) {
    return { ok: false, error: '必须提供 watermark 文件或 text 参数' };
  }

  const positionRaw = ((formData.get('position') as string | null) || 'bottom-right').trim() as WatermarkPosition;
  if (!VALID_POSITIONS.has(positionRaw)) {
    return { ok: false, error: `无效的 position 参数，可选值: ${[...VALID_POSITIONS].join(', ')}` };
  }

  const formatRaw = ((formData.get('format') as string | null) || 'webp').trim().toLowerCase() as OutputFormat;
  if (!VALID_FORMATS.has(formatRaw)) {
    return { ok: false, error: `无效的 format 参数，可选值: ${[...VALID_FORMATS].join(', ')}` };
  }

  const opacity = clampNumber(formData.get('opacity'), 0, 1, 0.5);
  const scale = clampNumber(formData.get('scale'), 0.05, 1, 0.2);
  const margin = clampNumber(formData.get('margin'), 0, 2000, 20);
  const quality = Math.round(clampNumber(formData.get('quality'), 1, 100, 85));

  const fontSizeRaw = formData.get('fontSize');
  const fontSize = fontSizeRaw != null && String(fontSizeRaw).trim() !== ''
    ? Math.round(clampNumber(fontSizeRaw, 8, 512, 32))
    : undefined;

  const color = ((formData.get('color') as string | null) || '#ffffff').trim();

  return {
    ok: true,
    options: {
      type,
      text,
      position: positionRaw,
      opacity,
      scale,
      margin,
      fontSize,
      color,
      format: formatRaw,
      quality,
    },
  };
}

export async function applyWatermark(
  imageBuffer: Buffer,
  opts: WatermarkOptions
): Promise<{ buffer: Buffer; width: number; height: number; format: OutputFormat }> {
  const meta = await sharp(imageBuffer).metadata();
  if (!meta.width || !meta.height) {
    throw new Error('无法读取图片尺寸');
  }
  const mainW = meta.width;
  const mainH = meta.height;

  const overlay = opts.type === 'text'
    ? await buildTextOverlay(opts, mainW, mainH)
    : await buildImageOverlay(opts, mainW, mainH);

  const compositeInputs: sharp.OverlayOptions[] = opts.position === 'tile'
    ? [{ input: overlay.buffer, tile: true, blend: 'over', gravity: 'northwest' }]
    : [{
        input: overlay.buffer,
        blend: 'over',
        ...computePosition(mainW, mainH, overlay.width, overlay.height, opts.position, opts.margin),
      }];

  const pipeline = sharp(imageBuffer).composite(compositeInputs);
  const buffer = await finalizeOutput(pipeline, opts.format, opts.quality);

  return { buffer, width: mainW, height: mainH, format: opts.format };
}

async function buildImageOverlay(
  opts: WatermarkOptions,
  mainW: number,
  mainH: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (!opts.watermarkBuffer) {
    throw new Error('图片水印需要提供 watermark 文件');
  }

  const targetWidth = Math.max(1, Math.round(Math.min(mainW, mainH) * opts.scale));

  const resized = await sharp(opts.watermarkBuffer)
    .ensureAlpha()
    .resize({ width: targetWidth, fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = resized.data;
  for (let i = 3; i < pixels.length; i += 4) {
    pixels[i] = Math.round(pixels[i] * opts.opacity);
  }

  const buffer = await sharp(pixels, {
    raw: { width: resized.info.width, height: resized.info.height, channels: 4 },
  }).png().toBuffer();

  return { buffer, width: resized.info.width, height: resized.info.height };
}

async function buildTextOverlay(
  opts: WatermarkOptions,
  mainW: number,
  mainH: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const text = opts.text ?? '';
  const autoFontSize = Math.max(14, Math.round(Math.min(mainW, mainH) / 24));
  const fontSize = opts.fontSize ?? autoFontSize;

  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const charWidth = fontSize * 0.6;
  const horizontalPadding = Math.round(fontSize * 0.6);
  const width = Math.max(32, Math.ceil(text.length * charWidth) + horizontalPadding * 2);
  const height = Math.ceil(fontSize * 1.5);
  const strokeWidth = Math.max(1, fontSize / 24);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text x="${width / 2}" y="${height / 2}"
    font-family="Arial, Helvetica, 'DejaVu Sans', 'Noto Sans CJK SC', 'Noto Sans', sans-serif"
    font-size="${fontSize}"
    fill="${opts.color}"
    fill-opacity="${opts.opacity}"
    stroke="black"
    stroke-opacity="${opts.opacity * 0.4}"
    stroke-width="${strokeWidth}"
    paint-order="stroke"
    text-anchor="middle"
    dominant-baseline="central">${escaped}</text>
</svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, width, height };
}

function computePosition(
  W: number,
  H: number,
  w: number,
  h: number,
  pos: WatermarkPosition,
  margin: number
): { left: number; top: number } {
  const m = margin;
  switch (pos) {
    case 'top-left':
      return { left: m, top: m };
    case 'top-right':
      return { left: Math.max(0, W - w - m), top: m };
    case 'bottom-left':
      return { left: m, top: Math.max(0, H - h - m) };
    case 'center':
      return {
        left: Math.max(0, Math.round((W - w) / 2)),
        top: Math.max(0, Math.round((H - h) / 2)),
      };
    case 'bottom-right':
    default:
      return { left: Math.max(0, W - w - m), top: Math.max(0, H - h - m) };
  }
}

function finalizeOutput(pipeline: sharp.Sharp, format: OutputFormat, quality: number): Promise<Buffer> {
  switch (format) {
    case 'jpeg':
      return pipeline.flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer();
    case 'png':
      return pipeline.png({ compressionLevel: 9 }).toBuffer();
    case 'webp':
    default:
      return pipeline.webp({ quality }).toBuffer();
  }
}

export function formatToMime(format: OutputFormat): string {
  switch (format) {
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp':
    default: return 'image/webp';
  }
}

function clampNumber(value: FormDataEntryValue | null, min: number, max: number, fallback: number): number {
  if (value == null) return fallback;
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
