'use strict';

const { parsed } = require('../../processor').support;

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
			Program: function (_node) {
				const translator = parsed(context.getFilename());
				if (!translator || !translator.FW) return; // regular js source, or no FW present

				context.report({
					loc: translator.FW.loc,
					message: 'uses deprecated Translator Framework'
				});
			}
		};
	},
};
