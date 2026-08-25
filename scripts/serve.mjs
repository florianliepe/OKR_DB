import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const mimeTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const requestedPath = normalize(join(root, pathname === '/' ? 'index.html' : pathname));
    if (!requestedPath.startsWith(root)) {
        response.writeHead(403).end('Forbidden');
        return;
    }
    try {
        const file = (await stat(requestedPath)).isDirectory() ? join(requestedPath, 'index.html') : requestedPath;
        response.writeHead(200, { 'Content-Type': `${mimeTypes[extname(file)] || 'application/octet-stream'}; charset=utf-8` });
        createReadStream(file).pipe(response);
    } catch {
        response.writeHead(404).end('Not found');
    }
}).listen(port, '127.0.0.1', () => console.log(`OKR Cockpit available at http://127.0.0.1:${port}`));
