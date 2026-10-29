// Builds the extension into dist/.
// 1. Vite: popup + options pages (React) and public/ (manifest, icons)
// 2. esbuild: background (ES module), content + page scripts (classic IIFE, as Chrome needs)
import { build as vite } from 'vite';
import { context, build } from 'esbuild';

const watch = process.argv.includes('--watch');

await vite({ configFile: 'vite.config.ts', build: { watch: watch ? {} : null } });

const scripts = [
  { entryPoints: ['src/background/index.ts'], outfile: 'dist/background.js', format: 'esm' },
  { entryPoints: ['src/content/index.ts'], outfile: 'dist/content.js', format: 'iife' },
  { entryPoints: ['src/content/page.ts'], outfile: 'dist/page.js', format: 'iife' },
].map((o) => ({ ...o, bundle: true, target: 'chrome120', logLevel: 'info' }));

if (watch) {
  for (const o of scripts) await (await context(o)).watch();
} else {
  await Promise.all(scripts.map((o) => build(o)));
}
