'use strict';

const translators = require('../translators').cache;

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'disallow invalid JSON in header',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (_node) {
				const translator = translators.get(context.getFilename());

				if (!translator.source) return; // regular js source

				if (translator.header.error) {
					context.report({
						message: `Could not parse header: ${translator.header.error.message}`,
						loc: { start: { line: translator.error.line, column: translator.error.column } },
					});
				}
			}
		};
	},
};
