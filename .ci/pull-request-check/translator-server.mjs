import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';

const host = 'localhost';
const port = 8085;

var server;
var translators = [];
var idToTranslator = {};
var filenameToTranslator = {};
const rootPath = path.join(import.meta.dirname, '../..');
const infoRe = /^\s*{[\S\s]*?}\s*?[\r\n]/;

async function loadTranslators() {
	// Always reload from disk to pick up newly created/modified translators
	translators = [];
	idToTranslator = {};
	filenameToTranslator = {};
	const files = await fs.readdir(rootPath);
	for (const file of files) {
		const fullPath = path.join(rootPath, file);
		if (!fullPath.endsWith('.js') || !(await fs.stat(fullPath)).isFile()) continue;
		let content = await fs.readFile(fullPath, 'utf-8');
		let translator;
		try {
			let translatorInfo = JSON.parse(infoRe.exec(content)[0]);
			translator = { metadata: translatorInfo, content };
			idToTranslator[translatorInfo.translatorID] = translator;
		}
		catch (e) {
			translator = { metadata: null, content };
		}
		translators.push(translator);
		filenameToTranslator[file] = translator;
	}
}

async function serveMetadata(req, res) {
	if (!translators.length) await loadTranslators();
	res.writeHead(200);
	res.end(JSON.stringify(translators.map(t => t.metadata)));
}

async function serveCode(req, res) {
	const id = decodeURI(req.url.split('/')[2].split('?')[0]);
	if (idToTranslator[id]) {
		res.writeHead(200);
		res.end(idToTranslator[id].content);
	}
	else {
		res.writeHead(404);
		res.end();
	}
}

async function requestListener(req, res) {
	if (req.url.startsWith('/metadata')) {
		return serveMetadata(req, res);
	} else if (req.url.startsWith('/code')) {
		return serveCode(req, res);
	} else if (req.url === '/blank') {
		// Blank page with permissive CSP for import/search translator tests.
		// Content scripts injected here can eval() translator code.
		res.writeHead(200, {
			'Content-Type': 'text/html',
			'Content-Security-Policy': "script-src * 'unsafe-eval' 'unsafe-inline'",
		});
		res.end('<!DOCTYPE html><html><head><title>Translator Test</title></head><body></body></html>');
		return;
	}
	res.writeHead(404);
	res.end();
}

async function serve() {
	await loadTranslators();
	server = http.createServer(requestListener);
	return new Promise((resolve, reject) => {
		server.on('error', (err) => {
			if (err.code === 'EADDRINUSE') {
				// Port in use from a previous run - that's fine, the old server
				// has our translators (or close enough). But we should warn.
				console.error(`Warning: port ${port} already in use, reusing existing server`);
				server = null;
				resolve();
			}
			else {
				reject(err);
			}
		});
		server.listen(port, host, () => {
			console.log(`Translator server is running on http://${host}:${port}`);
			resolve();
		});
	});
}

function stopServing() {
	if (server) server.close();
}

export { serve, stopServing, filenameToTranslator, translators };
