'use strict';

const { parsed } = require('../../processor').support;

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'enforce translatorType against handler functions',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (program) {
				const translator = parsed(context.getFilename());
				if (!translator || !translator.header.fields) return; // regular js source, or header is invalid

				const functions = program.body.map((node) => {
					if (node.type === 'FunctionDeclaration') return node.id && node.id.name;
					if (node.type === 'VariableDeclaration'
						&& node.declarations.length === 1
						&& node.declarations[0].init
						&& node.declarations[0].init.type === 'FunctionExpression') {
						return node.declarations[0].id.name;
					}
					return null;
				})
					.filter(name => name);

				const type = {
					import: 1,
					export: 2,
					web: 4,
					search: 8
				};

				const translatorType = translator.header.fields.translatorType;
				const browserSupport = translator.header.fields.browserSupport;

				if (browserSupport && !(translatorType & type.web)) {
					context.report({
						loc: { start: { line: 1, column: 1 } },
						message: `browserSupport set, but translatorType (${translatorType}) does not include web (${type.web})`,
					});
					return;
				}

				for (const name of ['detectWeb', 'doWeb', 'detectImport', 'doImport', 'doExport', 'detectSearch', 'doSearch']) {
					const handler = functions.includes(name);
					const mode = name.replace(/^(detect|do)/, '').toLowerCase();
					const bit = type[mode];
					if (handler && !(translatorType & bit)) {
						context.report({
							loc: { start: { line: 1, column: 1 } },
							message: `${name} present, but translatorType (${translatorType}) does not specify ${mode} (${bit})`,
						});
						return;
					}
					if (!handler && (translatorType & bit)) {
						let message = `translatorType specifies ${mode} (${bit}), but no ${name} present`;
						if (translatorType & type.web && mode !== 'web') {
							// Lots of common errors involve web translator developers not understanding
							// translator type jargon and checking too many boxes - checking "search"
							// because the translator supports search pages, or "import" because it
							// imports items from the site.
							// Be extra explicit when it seems like that might be the situation.
							message += `. This web translator is probably NOT a${bit <= 2 ? 'n' : ''} ${mode} translator, `
								+ `even if it supports "${mode}" pages or "${mode}ing". Uncheck "${mode}" in Scaffold.`;
						}
						context.report({
							loc: { start: { line: 1, column: 1 } },
							message,
						});
						return;
					}
				}
			}
		};
	},
};
