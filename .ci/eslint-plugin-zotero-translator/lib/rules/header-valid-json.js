'use strict';

const { parsed, json } = require('../../processor').support;

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
				const translator = parsed(context.getFilename());

				if (!translator || translator.header.fields) return; // regular js source, or header is valid json

				const err = json.try(translator.header.text, { line: 0, position: 1 });
				if (err) {
					context.report({
						message: `Could not parse header: ${err.message}`,
						loc: { start: { line: err.line, column: err.column } },
					});
				}
			}
		};
	},
};
