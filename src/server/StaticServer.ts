import { join } from 'path';
import { Server } from 'http';
import { existsSync, readFile } from 'fs';
import { lookup } from 'mime-types';
export default function serveStatic(path: string): Server {
    return new Server((req, res) => {
        // Don't interfere with the websocket server
        if (req.headers.upgrade == 'websocket') return;
        const url = req.url?.replace(/^\/+|\/+$/, '') || 'index.html';
        const file_path = join(path, url);
        if (!existsSync(file_path)) {
            res.writeHead(404, 'file not found').write(`Full path: ${file_path}`);
            res.end();
        }
        readFile(file_path, (err, data) => {
            if (err) res.writeHead(500, err.message).end();
            else {
                res.setHeader('Content-Type', lookup(file_path) || 'application/octet-stream');
                res.write(data, () => res.end());
            }
        });
    });
}