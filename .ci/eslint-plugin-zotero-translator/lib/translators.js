'use strict';

const fs = require('fs');
const path = require('path');
const findRoot = require('find-root');
const childProcess = require('child_process');

const repo = path.resolve(findRoot(__dirname, dir => fs.existsSync(path.resolve(dir, '.git'))));

const metaDataRules = [
	'zotero-translator/header-valid-json',
	'zotero-translator/last-updated',
	'zotero-translator/translator-id',
	'zotero-translator/test-cases-valid-json',
	'zotero-translator/test-cases',
	'zotero-translator/translator-type',
	'zotero-translator/prefer-index-of',
	'zotero-translator/no-for-each',
	'zotero-translator/not-executable',
	'indent',
].join(', ');

const headerVar = '__eslintZoteroTranslatorHeader';
const headerPrefix = `/* eslint-disable no-unused-vars */ const ${headerVar} = /* eslint-disable */(/* eslint-enable ${metaDataRules} */`;

function jsonParseWithErrorInfo(raw, source) {
	const target = { raw };
	target.lines = target.raw.split('\n').length;

	try {
		target.parsed = JSON.parse(target.raw);
	}
	catch (err) {
		const position = err.message.match(/at position ([0-9]+)/);
		const at = position ? parseInt(position[1]) : 0;
		target.error = {
			message: err.message,
			line: source.substring(0, source.indexOf(raw)).split('\n').length // start of raw JSON
				+ target.raw.substring(0, at).split('\n').length, // line within raw JSON
			column: at - target.raw.lastIndexOf('\n', at),
		};
	}

	return target;
}

function escapeRE(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
const re = {
	undecorated: new RegExp(
		/^(\{[\s\S]+?\n\})/.source // the header
		+ /(\n[\s\S]+?)/.source // the code
		+ '(?:' // test cases
		+ /(\/\*\* BEGIN TEST CASES \*\*\/)([\s\S]+?)/.source // var testCases =
		+ /(\[[\s\S]+\])/.source // the test cases
		+ /([\s\S]+)/.source // trailing stuff after the test cases
		+ ')?$' // test cases are optional
	),

	decorated: new RegExp(
		/^([\s\S]*?)/.source // anything the fixer might have placed at the top
		+ escapeRE(headerPrefix) // all the eslint junk we injected
		+ /(\{[\s\S]+\})/.source // the header
		+ escapeRE(');/* eslint-enable */') // more eslint stuff we injected
		+ /([\s\S]+?)/.source // the code
		+ '(?:' // optional test cases
		+ /(\/\*\* BEGIN TEST CASES \*\*\/)/.source
		+ escapeRE('/* eslint-disable */') // more eslint stuff we injected
		+ /([\s\S]+?)/.source // var testCases =
		+ escapeRE(`/* eslint-enable ${metaDataRules} */`)
		+ /([\s\S]+)/.source
		+ ')?$'
	),
};

const tfw = {
	rules: [
		'block-spacing',
		'brace-style',
		'comma-spacing',
		'consistent-return',
		'consistent-this',
		'key-spacing',
		'keyword-spacing',
		'no-array-constructor',
		'no-cond-assign',
		'no-new-object',
		'no-sequences',
		'no-undef',
		'no-unused-expressions',
		'no-void',
		'object-curly-spacing',
		'semi',
		'semi-spacing',
		'space-before-blocks',
		'space-before-function-paren',
		'space-infix-ops',
	]
};
tfw.disable = ` // eslint-disable-line ${tfw.rules.join(', ')}`;
tfw.disableRe = new RegExp('(\\n' + escapeRE('/* FW LINE 59:b820c6d */') + '[^\\n]+?)(' + escapeRE(tfw.disable) + ')?(\\n)');

function decorate(source) {
	const decorated = {};

	if (!source.startsWith('{')) return decorated;

	let m = source.match(re.undecorated);
	if (!m) throw new Error('no header');

	let [, header, code, testCasesPrefix, testCasesVar, testCases, testCasesPostfix] = m;

	code = code.replace(tfw.disableRe, `$1${tfw.disable}$3`);

	// decorate header
	decorated.header = jsonParseWithErrorInfo(header, source);

	decorated.source = headerPrefix
		+ header // the JSON
		+ ');/* eslint-enable */'
		+ code; // the actual code

	if (testCasesPrefix) {
		decorated.testCases = jsonParseWithErrorInfo(testCases, source);

		decorated.source += testCasesPrefix // the prefix
			+ '/* eslint-disable */' // disable all the rules
			+ testCasesVar
			+ `/* eslint-enable ${metaDataRules} */` // enable JSON rules
			+ testCases
			+ testCasesPostfix;
	}

	return decorated;
}

function tryFormatJSON(raw) {
	try {
		return JSON.stringify(JSON.parse(raw), null, '\t');
	}
	catch (_err) {
		return raw;
	}
}
function strip(source) {
	const m = source.match(re.decorated);
	if (!m) throw new Error('not decorated');

	let [, prefix, header, code, testCasesPrefix, testCasesVar, testCases] = m;

	code = code.replace(tfw.disableRe, '$1$3');

	return tryFormatJSON(header) + (prefix ? '\n\n' + prefix.replace(/^\s*/, '') : '') + code + (testCasesPrefix || '') + tryFormatJSON(testCasesVar || '') + (testCases || '');
}

function exec(cmd) {
	return childProcess.execSync(cmd, { cwd: repo, encoding: 'utf8' });
}

class Cache {
	constructor() {
		this.decorated = {};

		this.repo = path.resolve(repo);
		for (const translator of fs.readdirSync(this.repo)) {
			if (!translator.endsWith('.js')) continue;
			this.decorated[path.basename(translator)] = decorate(fs.readFileSync(path.join(repo, translator), 'utf-8'));
		}

		const branch = exec('git rev-parse --abbrev-ref HEAD').trim();

		const hasUpstream = exec('git remote -v').split('\n')
			.map(line => line.trim())
			.includes('upstream\thttps://github.com/zotero/translators.git');
		// branch to compare lastUpdated against -- assume that if have upstream/master, you want to compare against that
		const master = hasUpstream ? 'upstream/master' : 'master';

		this.lastUpdated = {};
		if (branch !== master) {
			// `git diff --name-status ${master}` will fetch the names of the files that have changed against `${master}`
			for (const file of exec(`git diff --name-status ${master}`).split('\n')) {
				const m = file.match(/^M\t([^/]+\.js)$/); // js files that are modified but don't have a / in their path to pick out files in the root
				if (m && this.decorated[m[1]]) this.decorated[m[1]].modified = true;
			}

			/*
				We do a `git grep '"lastUpdated"' ${master} *.js` to get the
				`lastUpdated` values from the `${master}` branch. For files that are
				deemed changed, the lastUpdated is remembered (so the presence of lastUpdated implies modified).
				This info is used in the 'last-updated' rule.
			*/
			for (const lu of exec(`git grep '"lastUpdated"' ${master} *.js`).split('\n')) {
				const m = lu.match(/^[a-z/]+:([^:]+):\s*"lastUpdated"\s*:\s*"([-0-9: ]+)"/);
				if (!m) continue;
				const translator = m[1];
				if (this.decorated[translator] && this.decorated[translator].modified) this.decorated[translator].lastUpdated = m[2];
			}
		}
	}

	get(filename) {
		const basename = path.basename(filename);

		// don't load stuff outside the root dir
		if (!this.decorated[basename] && path.dirname(path.resolve(filename)) !== this.repo) this.decorated[basename] = {};

		return this.decorated[basename];
	}

	conflicts(filename, translatorID) {
		filename = path.basename(filename);
		for (const [otherFilename, otherHeader] of Object.entries(this.decorated)) {
			if (otherFilename !== filename && otherHeader.translatorID === translatorID) {
				return otherHeader.parsed;
			}
		}
		return false;
	}
}

function getHeaderFromAST(programNode) {
	const declaration = programNode.body[0];
	if (!declaration) return {};
	if (declaration.type !== 'VariableDeclaration' || declaration.declarations.length !== 1 || declaration.declarations[0].id.name !== headerVar) return {};

	const body = declaration.declarations[0].init;
	if (!body || body.type !== 'ObjectExpression') return {};

	const properties = {};
	for (const property of body.properties) {
		properties[property.key.value] = property.value;
	}
	return { declaration, body, properties, followingStatement: programNode.body[1] };
}

module.exports = {
	decorate,
	strip,
	cache: new Cache(),
	getHeaderFromAST,
};

if (require.main === module) {
	const orig = fs.readFileSync(path.join(__dirname, '../../../Amazon.js'), 'utf-8');
	const decorated = decorate(orig);
	const stripped = strip(decorated.source);
	console.log(stripped === orig); // eslint-disable-line no-console
}
