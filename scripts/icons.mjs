// Renders public/icons/icon.svg to PNGs. Run once: node scripts/icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
// CHROME_PATH lets you use an existing Chrome instead of a Playwright download.
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
for (const size of [16, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>*{margin:0}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await page.screenshot({ path: `public/icons/${size}.png`, omitBackground: true });
}
await browser.close();
