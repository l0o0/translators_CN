'use strict';

const translators = require('../translators').cache;

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'disallow invalid JSON in test cases',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (_node) {
				const translator = translators.get(context.getFilename());

				if (!translator.testCases) return; // regular js or no test cases

				if (translator.testCases.error) {
					context.report({
						message: `Could not parse testCases: ${translator.testCases.error.message}`,
						loc: { start: { line: translator.testCases.error.line, column: translator.testCases.error.column } },
					});
				}
			}
		};
	},
};
