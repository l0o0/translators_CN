import chalk from 'chalk';
import path from 'path';
import process from 'process';
import { Builder, By } from 'selenium-webdriver';
import * as chrome from 'selenium-webdriver/chrome.js';
import * as until from 'selenium-webdriver/lib/until.js';
import * as translatorServer from './translator-server.mjs';

const chromeExtensionDir = path.join(import.meta.dirname, 'connectors', 'build', 'manifestv3');
const KEEP_BROWSER_OPEN = 'KEEP_BROWSER_OPEN' in process.env;
const CI = 'CI' in process.env;
const ZOTERO_CONNECTOR_EXTENSION_ID = 'ekhagklcjbdpajgpjgmbionohlpdbjgc';

async function getTranslatorsToTest() {
	const translatorFilenames = process.argv[2].split('\n').filter(filename => filename.trim().length > 0);
	let changedTranslatorIDs = [];
	let toTestTranslatorIDs = new Set();
	let toTestTranslatorNames = new Set();
	for (const translatorFilename of translatorFilenames) {
		let translator = translatorServer.filenameToTranslator[translatorFilename];
		if (!translator) {
			console.error(chalk.yellow(`Translator '${translatorFilename}' not found`));
			continue;
		}
		else if (translator.metadata === null) {
			console.error(chalk.red(`
Translator '${translatorFilename}' is not correctly formatted.

Please use Scaffold (Tools → Translator Editor) to create translators, and test
that your translator works before opening a PR.

AI tools may help with drafting code to add to your translator, but you should
never use an AI tool to generate its overall structure without using Scaffold
first. LLMs have very little Zotero translator code in their training sets and
generally fail to generate translator code with a valid layout (or even a real
UUID).
				`.trim()));
			continue;
		}
		let metadata = translator.metadata;
		changedTranslatorIDs.push(metadata.translatorID);
		toTestTranslatorIDs.add(metadata.translatorID);
		toTestTranslatorNames.add(metadata.label);
	}

	// Find all translators that use the changed translators and add them to list/check them too
	let changedTranslatorIDRe = new RegExp(changedTranslatorIDs.join('|'));
	let tooManyTranslators = false;
	for (let translator of translatorServer.translators) {
		if (!changedTranslatorIDRe.test(translator.content)) continue;
		toTestTranslatorIDs.add(translator.metadata.translatorID);
		toTestTranslatorNames.add(translator.metadata.label);
		if (toTestTranslatorIDs.size >= 10) {
			tooManyTranslators = true;
			break;
		}
	}
	if (tooManyTranslators) {
		console.log(
`Over 10 translators need to be tested, but this will take too long
and timeout the CI environment. Truncating to 10.

This is likely to happen when changing Embedded Metadata which is
loaded by pretty much every other translator or when a PR contains
a lot of changed translators.

You may want to consider adding '[ci skip]' in the commit message.`
		)
	}
	console.log(`Will run tests for translators ${JSON.stringify(Array.from(toTestTranslatorNames))}`);
	return Array.from(toTestTranslatorIDs);
}

function report(results) {
	var allPassed = true;
	for (let translatorID in results) {
		let translatorResults = results[translatorID];
		console.log(chalk.bold(chalk.bgWhite(chalk.black(`Running tests for ${translatorID}: ${translatorResults.label}`))));
		let padding = 2;
		let output = translatorResults.message.split("\n");
		for (let line of output) {
			if (/^Running \d+ tests? for/.test(line)) {
				console.log("  ".repeat(padding - 1) + chalk.bgCyan(chalk.black(line)));
			}
			else if (line.match(/^-/)) {
				console.log(chalk.red("-" + "  ".repeat(padding) + line.substr(1)));
			}
			else if (line.match(/^\+/)) {
				console.log(chalk.green("+" + "  ".repeat(padding) + line.substr(1)));
			}
			else if (line.match(/^Test \d+: succeeded/)) {
				console.log("  ".repeat(padding) + chalk.bgGreen(line));
			}
			else if (line.match(/^Test \d+: failed/)) {
				console.log("  ".repeat(padding) + chalk.bgRed(line));
				allPassed = false;
			}
			else {
				console.log("  ".repeat(padding) + line);
			}
		}
		console.log("\n");
	}

	return allPassed
}

var allPassed = false;

let driver;
try {
	await translatorServer.serve();

	let options = new chrome.Options();
	options.addArguments('--disable-features=DisableLoadExtensionCommandLineSwitch');
	options.addArguments(`load-extension=${chromeExtensionDir}`);
	if (CI) {
		options.addArguments('headless=new');
	}
	if ('BROWSER_EXECUTABLE' in process.env) {
		console.log(`Using BROWSER_EXECUTABLE=${process.env['BROWSER_EXECUTABLE']}`);
		options.setChromeBinaryPath(process.env['BROWSER_EXECUTABLE']);
	}

	driver = await new Builder()
		.forBrowser('chrome')
		.setChromeOptions(options)
		.build();

	const translatorsToTest = await getTranslatorsToTest();
	await new Promise(resolve => setTimeout(resolve, 500));

	let testUrl = `chrome-extension://${ZOTERO_CONNECTOR_EXTENSION_ID}/tools/testTranslators/testTranslators.html#translators=${translatorsToTest.join(',')}`;
	await driver.get(testUrl);

	if ((await driver.getTitle()).trim() !== 'Zotero Translator Tester') {
		console.error('Failed to load Translator Tester extension page');
		process.exit(2);
	}

	await driver.wait(until.elementLocated(By.id('translator-tests-complete')), 5 * 60 * 1000);

	let testResults = await driver.executeScript('return window.seleniumOutput');
	allPassed = report(testResults);
}
catch (e) {
	console.error(e);
}
finally {
	if (!KEEP_BROWSER_OPEN) {
		await driver.quit();
	}
	translatorServer.stopServing();
	if (allPassed) {
		console.log(chalk.green("All translator tests passed"));
	} else {
		console.log(chalk.red("Some translator tests failed"));
	}
	process.exit(allPassed ? 0 : 1);
}
