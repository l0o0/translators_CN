'use strict';

const translators = require('../translators');

module.exports = {
	meta: {
		type: 'problem',
		fixable: 'code',
		docs: {
			description: 'checks use of deprecated Translator Framework',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (node) {
				const header = translators.getHeaderFromAST(node);
				if (!header.body) return; // if there's no file header, assume it's not a translator

				const sourceCode = context.getSourceCode();
				for (const comment of sourceCode.getAllComments()) {
					if (comment.value.match(/^\s*FW LINE [0-9]+:/)) {
						context.report({
							loc: comment.loc,
							message: 'uses deprecated Translator Framework'
						});
					}
				}
			}
		};
	},
};
