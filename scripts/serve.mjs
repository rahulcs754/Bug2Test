// Static server for site/ (landing page + demo shop), used by the e2e tests.
// Port 4173 serves the buggy demo. Port 4174 serves the same files with the fixes turned on.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'site');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serve(port, fixed) {
  createServer(async (req, res) => {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path.endsWith('/')) path += 'index.html';
    try {
      let body = await readFile(join(ROOT, path));
      if (fixed && path.endsWith('shop.js')) body = Buffer.concat([Buffer.from('window.BUG2TEST_FIXED = true;\n'), body]);
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  }).listen(port, () => console.log(`site on http://localhost:${port}${fixed ? ' (fixed)' : ''}`));
}

serve(4173, false);
serve(4174, true);
