#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const find = require('recursive-readdir');
const { ESLint } = require("eslint");
const argv = require('commander');

const translators = require('../lib/translators');

argv
	.version(ESLint.version)
	.option('-o, --output-json [file | -]', 'Write report to file or stdout as JSON')
	.option('-f, --fix', 'Automatically fix problems')
	.option('--no-ignore', 'Disable use of ignore files and patterns')
	.option('--quiet', 'Report errors only - default: false')
	.option('--dump-decorated [file]', 'Dump decorated translator to file for inspection')
	.parse(process.argv);

/* PATCHES */
// disable the processor so that fixing works
const eslintPluginZoteroTranslator = require('eslint-plugin-zotero-translator');
delete eslintPluginZoteroTranslator.processors;

async function main() {
	// split sources to lint into regular javascript (handled by lintFiles) and translators (handled by lintText)
	const sources = {
		javascripts: [],
		translators: [],
		errors: 0,
	};

	let allResults = [];

	function findIgnore(file, stats) {
		if (stats.isDirectory()) return (path.basename(file) == "node_modules" || path.basename(file) == ".ci");
		return !file.endsWith('.js');
	}
	for (const target of argv.args) {
		if (!fs.existsSync(target)) {
			console.error(`Target file '${target}' does not exist; skipping`); // eslint-disable-line no-console
			continue;
		}
		const files = fs.lstatSync(target).isDirectory() ? await find(target, [findIgnore]) : [target];
		for (const file of files) {
			if (path.dirname(path.resolve(file)) === translators.cache.repo) {
				const translator = translators.cache.get(file);
				if (translator.header) {
					translator.filename = file;
					sources.translators.push(translator);
				}
				else {
					sources.javascripts.push(file);
				}
			}
			else {
				sources.javascripts.push(file);
			}
		}
	}

	const eslint = new ESLint({
		cwd: translators.cache.repo,
		fix: argv.fix,
		ignore: !!argv.ignore, // otherwise you can't lint stuff in hidden dirs
	});
	const formatter = await eslint.loadFormatter();
	function showResults(files, results) {
		if (argv.quiet) results = ESLint.getErrorResults(results);
		for (const res of results) {
			sources.errors += res.errorCount;
		}

		if (results.length) {
			console.log(formatter.format(results)); // eslint-disable-line no-console
		}
		else {
			if (Array.isArray(files)) files = files.join(', ');
			if (!argv.quiet) console.log(files, 'OK'); // eslint-disable-line no-console
		}
	}

	if (sources.javascripts.length) {
		const results = await eslint.lintFiles(sources.javascripts);
		if (argv.fix) {
			for (const result of results) {
				if (result.messages.find(msg => msg.ruleId === 'notice/notice' && msg.fix)) {
					console.log(`Not safe to apply 'notice/notice' to ${result.filePath}`); // eslint-disable-line no-console
					process.exit(1); // eslint-disable-line no-process-exit
				}
			}
			ESLint.outputFixes(results);
		}
		if (argv.outputJson) {
			allResults.push(...results);
		}
		else {
			showResults(sources.javascripts, results);
		}
	}

	for (const translator of sources.translators) {
		if (argv.dumpDecorated) fs.writeFileSync(argv.dumpDecorated, translator.source, 'utf-8');
		const results = await eslint.lintText(translator.source, { filePath: translator.filename });
		if (argv.fix) {
			for (const result of results) {
				if (result.output) {
					try {
						fs.writeFileSync(result.filePath, translators.strip(result.output), 'utf-8');
					}
					catch (err) {
						console.log(`Error writing fixed ${result.filePath}: ${err.message}`); // eslint-disable-line no-console
						process.exit(1); // eslint-disable-line no-process-exit
					}
				}
			}
		}
		if (argv.outputJson) {
			allResults.push(...results);
		}
		else {
			showResults(translator.filename, results);
		}
	}

	if (argv.outputJson) {
		if (argv.outputJson === '-') {
			process.stdout.write(JSON.stringify(allResults) + '\n');
		}
		else {
			fs.writeFileSync(argv.outputJson, JSON.stringify(allResults), 'utf-8');
		}
	}
	else {
		process.exit(sources.errors); // eslint-disable-line no-process-exit
	}
}

main();
