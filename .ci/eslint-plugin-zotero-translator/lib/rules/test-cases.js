'use strict';

const { parsed, json } = require('../../processor').support;

function zip(arrays) {
	let zipped = null;
	for (const [key, array] of Object.entries(arrays)) {
		if (!zipped) {
			zipped = Array(array.length).fill(null).map((_, i) => ({ _: i }));
		}
		else if (array.length !== zipped.length) {
			throw new Error(`Array length mismatch: ${key} has ${array.length} elements, but ${zipped.length} expected`);
		}
		for (const [i, value] of array.entries()) {
			zipped[i][key] = value;
		}
	}
	return zipped;
}

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
				const translator = parsed(context.getFilename());
				if (!translator || !translator.testcases.text) return; // regular js source, or no testcases

				const err = json.try(translator.testcases.text, { line: translator.testcases.start, position: 3 });
				if (err) {
					context.report({
						message: `Could not parse testcases: ${err.message}`,
						loc: { start: { line: err.line, column: err.column } },
					});
					return;
				}

				const declaration = node.body.find(node => (
					node.type === 'VariableDeclaration'
					&& node.declarations.length === 1
					&& node.declarations[0].id.name === 'testCases'
				));
				if (declaration.followingStatement) {
					context.report({
						node: declaration.followingStatement,
						message: 'testCases should not have trailing code',
					});
				}

				const nodes = declaration.declarations[0].init.elements;
				if (!Array.isArray(nodes)) {
					context.report({
						node: declaration,
						message: 'testCases must be an array',
					});
					return;
				}

				const sourceCode = context.getSourceCode();
				const token = sourceCode.getLastToken(node);
				if (token.type === 'Punctuator' && token.value === ';') {
					context.report({
						message: 'testCases should not have trailing semicolon',
						loc: declaration.loc.end,
					});
				}

				zip({
					testCase: JSON.parse(translator.testcases.text),
					node: nodes,
				})
				.forEach(({ testCase, node }) => {
					if (!['web', 'import', 'search'].includes(testCase.type)) {
						context.report({
							node,
							message: `test case has invalid type "${testCase.type}"`,
						});
						return;
					}

					if (!(Array.isArray(testCase.items) || (testCase.type === 'web' && testCase.items === 'multiple'))) {
						context.report({
							node,
							message: `test case of type "${testCase.type}" needs items`,
						});
					}

					if (testCase.type === 'web' && typeof testCase.url !== 'string') {
						context.report({
							node,
							message: `test case of type "${testCase.type}" test needs url`,
						});
					}

					if (['import', 'search'].includes(testCase.type) && !testCase.input) {
						context.report({
							node,
							message: `test case of type "${testCase.type}" needs a string input`,
						});
					}
					else if (testCase.type === 'import' && typeof testCase.input !== 'string') {
						context.report({
							node,
							message: `test case of type "${testCase.type}" needs input`,
						});
					}
					else if (testCase.type === 'search') {
						const expected = ['DOI', 'ISBN', 'PMID', 'identifiers', 'contextObject', 'adsBibcode', 'ericNumber', 'openAlex'];
						const keys = Array.isArray(testCase.input) ? testCase.input.flatMap(Object.keys) : Object.keys(testCase.input);

						if (!keys.every(key => expected.includes(key))) {
							const invalidKey = keys.find(key => !expected.includes(key));
							context.report({
								node,
								message: `test case of type "${testCase.type}" has invalid search term '${invalidKey}' - expected one of ${expected.join(', ')}`,
							});
						}
					}

					if (Array.isArray(testCase.items)) {
						zip({
							item: testCase.items,
							node: node.properties.find(prop => prop.key.type === 'Literal' && prop.key.value === 'items').value.elements,
						})
						.forEach(({ item, node }) => {
							if (!Array.isArray(item.creators)) {
								context.report({
									message: 'creators should be an array',
									node,
								});
								return;
							}

							zip({
								creator: item.creators,
								node: node.properties.find(prop => prop.key.type === 'Literal' && prop.key.value === 'creators').value.elements,
							})
							.forEach(({ creator, node }) => {
								if (creator.fieldMode !== undefined && creator.fieldMode !== 1) {
									context.report({
										node,
										message: 'creator.fieldMode should be omitted or 1',
									});
								}
								else if (creator.fieldMode === 1 && (creator.firstName || !creator.lastName)) {
									context.report({
										node,
										message: 'creator with fieldMode == 1 should have lastName and no firstName',
									});
								}
								else if (!creator.firstName && !creator.lastName) {
									context.report({
										node,
										message: 'creator has no name',
									});
								}

								if (!creator.creatorType) {
									context.report({
										node,
										message: 'creator has no creatorType',
									});
								}
							});
						});
					}
				});
			}
		};
	},
};
