'use strict';

const translators = require('../translators').cache;

module.exports = {
	meta: {
		type: 'problem',

		docs: {
			description: 'disallow invalid tests',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (node) {
				const translator = translators.get(context.getFilename());

				const declaration = node.body.find(node => node.type === 'VariableDeclaration' && node.declarations.length === 1 && node.declarations[0].id.name === 'testCases');
				const testCases = declaration
					&& declaration.declarations[0].init
					&& declaration.declarations[0].init.type === 'ArrayExpression'
						? declaration.declarations[0].init.elements
						: [];

				if (declaration) {
					const sourceCode = context.getSourceCode();
					const token = sourceCode.getLastToken(node);
					if (token.type === 'Punctuator' && token.value === ';') {
						context.report({
							message: 'testCases should not have trailing semicolon',
							loc: declaration.loc.end,
						});
					}
				}

				if (!translator.testCases || translator.testCases.error) return; // regular js or no test cases

				let caseNo = -1;
				for (const testCase of translator.testCases.parsed) {
					caseNo += 1;
					const prefix = `test case${testCases[caseNo] ? '' : ' ' + (caseNo + 1)}`;
					const loc = testCases[caseNo] ? testCases[caseNo].loc.start : { start: { line: translator.testCases.start, column: 1 } };

					if (!['web', 'import', 'search'].includes(testCase.type)) {
						context.report({
							message: `${prefix} has invalid type "${testCase.type}"`,
							loc,
						});
						continue;
					}

					if (!(Array.isArray(testCase.items) || (testCase.type === 'web' && testCase.items === 'multiple'))) {
						context.report({
							message: `${prefix} of type "${testCase.type}" needs items`,
							loc,
						});
					}

					if (testCase.type === 'web' && typeof testCase.url !== 'string') {
						context.report({
							message: `${prefix} of type "${testCase.type}" test needs url`,
							loc,
						});
					}

					if (['import', 'search'].includes(testCase.type) && !testCase.input) {
						context.report({
							message: `${prefix} of type "${testCase.type}" needs a string input`,
							loc,
						});
					}
					else if (testCase.type === 'import' && typeof testCase.input !== 'string') {
						context.report({
							message: `${prefix} of type "${testCase.type}" needs input`,
							loc,
						});
					}
					else if (testCase.type === 'search') {
						// console.log(JSON.stringify(testCase.input))
						const expected = ['DOI', 'ISBN', 'PMID', 'identifiers', 'contextObject', 'adsBibcode'];
						if (!Object.keys(testCase.input).every(key => expected.includes(key))) {
							let invalidKey = Object.keys(testCase.input).find(key => !expected.includes(key));
							context.report({
								message: `${prefix} of type "${testCase.type}" has invalid search term '${invalidKey}' - expected one of ${expected.join(', ')}`,
								loc,
							});
						}
					}

					if (Array.isArray(testCase.items)) {
						let itemsNode = testCases[caseNo].properties
							.find(prop => prop.key.type == 'Literal' && prop.key.value == 'items')
							.value;
						for (let [itemIndex, item] of testCase.items.entries()) {
							let itemNode = itemsNode.elements[itemIndex];
							let itemLoc = itemNode.loc;
							
							if (!Array.isArray(item.creators)) {
								context.report({
									message: 'creators should be an array',
									loc: itemLoc,
								});
								continue;
							}

							for (let [creatorIndex, creator] of item.creators.entries()) {
								let creatorLoc = itemNode.properties
									.find(prop => prop.key.type == 'Literal' && prop.key.value == 'creators')
									.value
									.elements[creatorIndex]
									.loc;

								if (creator.fieldMode !== undefined && creator.fieldMode !== 1) {
									context.report({
										message: 'creator.fieldMode should be omitted or 1',
										loc: creatorLoc,
									});
								}
								else if (creator.fieldMode === 1 && (creator.firstName || !creator.lastName)) {
									context.report({
										message: 'creator with fieldMode == 1 should have lastName and no firstName',
										loc: creatorLoc,
									});
								}
								else if (!creator.firstName && !creator.lastName) {
									context.report({
										message: 'creator has no name',
										loc: creatorLoc,
									});
								}

								if (!creator.creatorType) {
									context.report({
										message: 'creator has no creatorType',
										loc: creatorLoc,
									});
								}
							}
						}
					}
				}
			}
		};
	},
};
