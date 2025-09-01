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
	if (!translators.length) {
		const files = await fs.readdir(rootPath);
		for (const file of files) {
			const fullPath = path.join(rootPath, file);
			if (!fullPath.endsWith('.js') || !(await fs.stat(fullPath)).isFile()) continue;
			let content = await fs.readFile(fullPath);
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
}

async function serveMetadata(req, res) {
	if (!translators.length) await loadTranslators();
	res.writeHead(200);
	res.end(JSON.stringify(translators.map(t => t.metadata)));
}

async function serveCode(req, res) {
	const id = decodeURI(req.url.split('/')[2].split('?')[0]);
	try {
		res.writeHead(200);
		res.end(idToTranslator[id].content);
	}
	catch (e) {
		res.writeHead(404);
		res.end();
	}
}

async function requestListener(req, res) {
	if (req.url.startsWith('/metadata')) {
		return serveMetadata(req, res);
	} else if (req.url.startsWith('/code')) {
		return serveCode(req, res);
	}
	res.writeHead(404);
	res.end();
}

async function serve() {
	await loadTranslators();
	server = http.createServer(requestListener);
	server.listen(port, host, () => {
		console.log(`Translator server is running on http://${host}:${port}`);
	});
}

function stopServing() {
	server.close();
}

export { serve, stopServing, filenameToTranslator, translators };
