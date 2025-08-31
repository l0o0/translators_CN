(async () => {
const { repo, parsed } = require('../.ci/eslint-plugin-zotero-translator/processor').support;
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const excepts = [];

async function getRecentCommits(filepath, count = 3) {
	const cmd = `git log -n ${count} --pretty=format:"{\\"author\\": \\"%an\\", \\"date\\": \\"%ci\\", \\"message\\": \\"%s\\"}" -- "${filepath}"`;
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout, _stderr) => {
			if (error) {
				reject(error);
			}
			else {
				resolve(stdout.trim()
				.split('\n')
				.filter(line => line)
				.map(line => JSON.parse(line)));
			}
		});
	});
}

const labelMap = JSON.parse(fs.readFileSync(`${repo}/data/data.json`, 'utf-8'));
const updateTimeMap = { };
let translators = { };

try {
	translators = JSON.parse(fs.readFileSync(`${repo}/data/dashboard.json`, 'utf-8'));
}
catch (error) {
	console.log(error);
}

for (const basename of fs.readdirSync(repo).sort()) {
	if (!basename.endsWith('.js') || excepts.includes(basename)) continue;
	const fullpath = path.join(repo, basename);
	const parsedFile = parsed(fullpath);
	if (!translators[basename]) {
		translators[basename] = { };
	}
	const translator = translators[basename];
	const enLabel = parsedFile.header.fields.label;
	const testCasesText = parsedFile.testcases.text;
	try {
		translator.header = parsedFile.header.fields;
		translator.testCases = testCasesText ? JSON.parse(testCasesText) : [];
		translator.zhLabel = labelMap[enLabel] || enLabel;
		await getRecentCommits(fullpath)
				.then(commits => translator.trends = commits)
				.catch(err => console.error('Error occurred:', err));
		updateTimeMap[basename] = {
			label: translator.zhLabel,
			lastUpdated: translator.header.lastUpdated
		};
	}
	catch (error) {
		console.log(basename);
		console.log(error);
	}
}

// console.log(translators);

fs.writeFileSync(
	`${repo}/data/data.json`,
	JSON.stringify(
		Object.fromEntries(Object.entries(labelMap).sort((a, b) => a[0].localeCompare(b[0]))),
		null,
		2
	)
);
fs.writeFileSync(`${repo}/data/translators.json`, JSON.stringify(updateTimeMap, null, 2));
fs.writeFileSync(`${repo}/data/dashboard.json`, JSON.stringify(translators, null, 2));
})();
