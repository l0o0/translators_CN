'use strict';

// this is a very simplistic rule to find 'for each' until I find a better eslint plugin that does this
module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'disallow deprecated "for each"',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (node) {
				let lineno = 0;
				for (const line of context.getSourceCode().getText().split('\n')) {
					lineno += 1;

					const m = line.match(/for each *\(/);
					if (m) {
						context.report({
							node,
							message: "Deprecated JavaScript 'for each' statement",
							loc: { start: { line: lineno, column: line.indexOf(m[0]) + 1 } },
						});
					}
				}
			}
		};
	},
};
