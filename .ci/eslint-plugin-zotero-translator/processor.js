'use strict';

const espree = require('espree');
const clarinet = require('clarinet');
const findRoot = require('find-root');
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

let repo;
try {
	repo = path.resolve(findRoot(__dirname, dir => fs.existsSync(path.join(dir, '.git'))));
}
catch (e) {
	console.error('ERROR: Translators can only be linted inside a clone of the zotero/translators repo (not a ZIP downloaded from GitHub)');
	console.error('	git clone https://github.com/zotero/translators.git');
	process.exit(1); // eslint-disable-line no-process-exit
}

function exec(cmd) {
	return childProcess.execSync(cmd, { cwd: repo, encoding: 'utf8' });
}

// have to pre-load everything to test for conflicting headers
const cache = new Map();

function updateCache(text, filename) {
	if (text[0] !== '{') return;
	if (cache.has(filename) && cache.get(filename).text === text) {
		// No change - no need to re-parse
		return;
	}

	// detect header
	const prefix = `const ZoteroTranslator${Date.now()} = `;
	const decorated = `${prefix}${text}`;
	let ast;
	try {
		ast = espree.parse(decorated, { comment: true, loc: true, ecmaVersion: 2023 });
	}
	catch (err) {
		console.log(filename, err.message);
		process.exit(1); // eslint-disable-line no-process-exit
	}

	const header = ((ast.body[0] || {}).declarations[0] || {}).init;
	const testcases = ast.body
		.filter((node, i) => i === ast.body.length - 1)
		.filter(node => node.type === 'VariableDeclaration' && node.declarations.length === 1).map(node => node.declarations[0])
		.filter(node => node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === 'testCases')
		.map(node => node.init)[0];

	const extract = (node) => {
		if (!node) return {};
		return {
			start: node.loc.start.line,
			end: node.loc.end.line,
			text: decorated.substring(node.start, node.end),
		};
	};

	const entry = {
		text,
		header: extract(header),
		testcases: extract(testcases),
		FW: ast.comments.find(comment => comment.type === 'Block' && comment.value.trim === 'FW LINE 59:b820c6d')
	};

	try {
		entry.header.fields = JSON.parse(entry.header.text);
	}
	catch (err) {
		// ignore
	}


	cache.set(filename, entry);
}

for (let filename of fs.readdirSync(repo).sort()) {
	if (!filename.endsWith('.js')) continue;
	filename = path.join(repo, filename);

	const text = fs.readFileSync(filename, 'utf-8');
	updateCache(text, filename);
}

for (const lu of exec(`git grep '"lastUpdated"' HEAD~1`).split('\n')) {
	const m = lu.match(/^HEAD~1:([^:]+):\s*"lastUpdated"\s*:\s*"([-0-9: ]+)"/);
	if (!m) continue;
	const [, translator, lastUpdated] = m;
	const filename = path.join(repo, translator);
	if (cache.has(filename)) cache.get(filename).lastUpdated = lastUpdated;
}

function tryJSON(json, offset) {
	const parser = clarinet.parser();
	let error;

	const message = e => ({
		message: (e.message || '').split('\n', 1)[0],
		line: parser.line + offset.line,
		column: parser.column,
		position: parser.position + offset.position,
	});

	// trigger the parse error
	parser.onerror = function (e) {
		error = message(e);
		parser.close();
	};

	try {
		parser.write(json).close();
	}
	catch (e) {
		return error || message(e);
	}

	return error;
}

function JSONTokens(json, offset) {
	const parser = clarinet.parser();
	const tokens = [];

	parser.onvalue = function (v) {
		tokens.push({ type: 'value', value: v, line: parser.line + offset.line, column: parser.column, position: parser.position + offset.position });
	};
	parser.onopenobject = function (key) {
		tokens.push({ type: 'object-open', key, line: parser.line + offset.line, column: parser.column, position: parser.position + offset.position });
	};
	parser.onkey = function (key) {
		tokens.push({ type: 'key', key, line: parser.line + offset.line, column: parser.column, position: parser.position + offset.position });
	};
	parser.oncloseobject = function () {
		tokens.push({ type: 'object-close', line: parser.line + offset.line, column: parser.column, position: parser.position + offset.position });
	};
	parser.onopenarray = function () {
		tokens.push({ type: 'array-open', line: parser.line + offset.line, column: parser.column, position: parser.position + offset.position });
	};
	parser.onclosearray = function () {
		tokens.push({ type: 'array-close', line: parser.line + offset.line, column: parser.column, position: parser.position + offset.position });
	};

	parser.write(json).close();
	return tokens;
}

function header(program) {
	if (!program) return null;
	if (program.type !== 'Program') return null;
	if (program.body.length === 0) return null;
	if (program.body[0].type !== 'ExpressionStatement') return null;
	if (program.body[0].expression.type !== 'ObjectExpression') return null;
	return program.body[0].expression;
}

function conflict(filename) {
	const translatorID = (((cache.get(filename) || {}).header || {}).fields || {}).translatorID;
	if (!translatorID) return null;
	for (const [other, header] of cache.entries()) {
		if (other !== filename && header.translatorID === translatorID) {
			return header.fields;
		}
	}
	return null;
}

const junk = new RegExp(`${path.sep}0_`.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&') + '.*');
module.exports = {
	support: {
		repo,
		parsed: filename => cache.get(filename.replace(junk, '')),
		header,
		IDconflict: conflict,
		json: {
			try: tryJSON,
			tokens: JSONTokens,
		}
	},

	supportsAutofix: true,

	preprocess: function (text, filename) {
		// We might be running on an in-memory version of the translator newer
		// than what we read from disk earlier, so update the cache
		updateCache(text, filename);

		const parsed = cache.get(filename);
		if (text[0] !== '{' || !parsed) return [{ text, filename }];

		if (parsed.header.text) {
			return [{ text: `(${text.slice(0, parsed.header.text.length)});${text.slice(parsed.header.text.length)}`, filename }];
		}
		else {
			return [{ text, filename }];
		}
	},

	postprocess: function (messages, filename) {
		messages = [].concat(...messages);

		const parsed = cache.get(filename);

		if (parsed) {
			const header = parsed.header;
			if (header.text) {
				messages = messages.filter((m) => {
					if (!m.ruleId) return true;
					if (m.ruleId.startsWith('zotero-translator/header') && m.line > header.end) return false;
					switch (m.ruleId) {
						case 'no-unused-expressions':
							return m.line !== 1;
						case 'quote-props':
							return m.line > header.end;
						default:
					}
					return true;
				});

				const adjust = (p) => {
					if (p > header.text.length) return p - 3; // remove '(' and ');'
					if (p > 1) return p - 1; // remove '('
					return p;
				};
				for (const m of messages) {
					if (m.fix) m.fix.range = m.fix.range.map(adjust);
					if (m.suggestions) {
						for (const s of m.suggestions) {
							if (s.fix) s.fix.range = s.fix.range.map(adjust);
						}
					}
				}
			}

			const testcases = parsed.testcases;
			if (testcases && testcases.text) {
				messages = messages.filter((m) => {
					if (!m.ruleId) return true;
					if (m.ruleId.startsWith('zotero-translator/test-cases') && m.line < testcases.start) return false;

					switch (m.ruleId) {
						case 'semi':
						case 'quote-props':
							return m.line < testcases.start || m.line > testcases.end;
						case 'lines-around-comment':
							return m.line !== testcases.end + 1;
					}
					return true;
				});
			}
		}

		return messages;
	},
};
