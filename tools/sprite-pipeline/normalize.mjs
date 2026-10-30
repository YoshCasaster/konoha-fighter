import sharp from 'sharp';

function isolateMainPose(data, width, height) {
  const size = width * height;
  const visible = new Uint8Array(size);
  const seen = new Uint8Array(size);
  for (let i = 0; i < size; i++) visible[i] = data[i * 4 + 3] > 80 ? 1 : 0;
  const components = [];
  const queue = new Int32Array(size);
  for (let start = 0; start < size; start++) {
    if (!visible[start] || seen[start]) continue;
    let head = 0, tail = 0, minX = width, minY = height, maxX = 0, maxY = 0;
    const pixels = [];
    queue[tail++] = start; seen[start] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      pixels.push(p); minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const next of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1])
        if (next >= 0 && visible[next] && !seen[next]) { seen[next] = 1; queue[tail++] = next; }
    }
    components.push({ pixels, minX, minY, maxX, maxY });
  }
  components.sort((a, b) => b.pixels.length - a.pixels.length);
  if (!components.length) throw new Error('Pose has no visible pixels');
  const main = components[0];
  const selected = components.filter((c, index) => index === 0 || (
    c.pixels.length >= Math.max(500, main.pixels.length * 0.012) &&
    c.minX > 8 && c.maxX < width - 9 && c.minY > 8 && c.maxY < height - 9 &&
    c.maxX >= main.minX - 60 && c.minX <= main.maxX + 60
  ));
  const keep = new Uint8Array(size);
  for (const component of selected) for (const p of component.pixels) {
    const x = p % width, y = Math.floor(p / width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) keep[ny * width + nx] = 1;
    }
  }
  for (let i = 0; i < size; i++) if (!keep[i]) data[i * 4 + 3] = 0;
  return { removedComponents: components.length - selected.length };
}

export async function normalizePose(buffer, { targetHeight, baseline, isolate = false }) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width, height = info.height;
  const cleanup = isolate ? isolateMainPose(data, width, height) : { removedComponents: 0 };
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] <= 16) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  if (maxX < minX) throw new Error('Pose has no usable alpha');
  const trimmed = await sharp(data, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }).png().toBuffer();
  const sourceWidth = maxX - minX + 1, sourceHeight = maxY - minY + 1;
  const scaledWidth = Math.min(470, Math.round(sourceWidth * targetHeight / sourceHeight));
  const scaledHeight = Math.round(sourceHeight * scaledWidth / sourceWidth);
  const resized = await sharp(trimmed).resize(scaledWidth, scaledHeight, { kernel: 'nearest' }).png().toBuffer();
  const left = Math.floor((512 - scaledWidth) / 2), top = baseline - scaledHeight + 1;
  if (left < 8 || top < 8 || top + scaledHeight > 504) throw new Error(`Normalized pose exceeds safe canvas: ${left},${top},${scaledWidth},${scaledHeight}`);
  const output = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }]).png().toBuffer();
  return { output, metrics: { source: [sourceWidth, sourceHeight], rendered: [scaledWidth, scaledHeight], baseline, ...cleanup } };
}
