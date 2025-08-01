#!/usr/bin/env node

const path = require('path');
const process = require('process');
const { Builder, By } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const until = require('selenium-webdriver/lib/until');
const chalk = require('chalk');

const translatorServer = require('./translator-server');

const chromeExtensionDir = path.join(__dirname, 'connectors', 'build', 'manifestv3');
const KEEP_BROWSER_OPEN = 'KEEP_BROWSER_OPEN' in process.env;
const CI = 'CI' in process.env;
const ZOTERO_CONNECTOR_EXTENSION_ID = 'ekhagklcjbdpajgpjgmbionohlpdbjgc';

async function getTranslatorsToTest() {
	const translatorFilenames = process.argv[2].split('\n').filter(filename => filename.trim().length > 0);
	let changedTranslatorIDs = [];
	let toTestTranslatorIDs = new Set();
	let toTestTranslatorNames = new Set();
	for (const translatorFilename of translatorFilenames) {
		let translatorInfo = translatorServer.filenameToTranslator[translatorFilename].metadata;
		changedTranslatorIDs.push(translatorInfo.translatorID);
		toTestTranslatorIDs.add(translatorInfo.translatorID);
		toTestTranslatorNames.add(translatorInfo.label);
	}
	// Find all translators that use the changed translators and add them to list/check them too
	let tooManyTranslators = false;
	for (let translator of translatorServer.translators) {
		for (let translatorID of changedTranslatorIDs) {
			if (!translator.content.includes(translatorID)) continue;

			toTestTranslatorIDs.add(translator.metadata.translatorID);
			toTestTranslatorNames.add(translator.metadata.label);
			if (toTestTranslatorIDs.size >= 10) {
				tooManyTranslators = true;
				break;
			}
		}
		if (tooManyTranslators) break;
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

(async function() {
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
			return;
		}

		await driver.wait(until.elementLocated(By.id('translator-tests-complete')), 5 * 60 * 1000);
		testResults = await driver.executeScript('return window.seleniumOutput');

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
})();
