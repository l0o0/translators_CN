'use strict';

const { parsed, header } = require('../../processor').support;

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'enforce valid lastUpdated in header',
			category: 'Possible Errors',
		},
		fixable: 'code',
	},

	create: function (context) {
		return {
			Program: function (node) {
				const filename = context.getFilename();
				const translator = parsed(filename);
				if (!translator || !translator.header.fields) return; // regular js source, or header is invalid

				const lastUpdated = header(node).properties.find(p => p.key.value === 'lastUpdated');

				if (!lastUpdated) {
					context.report({
						loc: { start: { line: 1, column: 1 } },
						message: 'Header needs lastUpdated field',
					});
					return;
				}

				const format = date => date.toISOString().replace('T', ' ').replace(/\..*/, '');
				const now = format(new Date());
				const fix = fixer => fixer.replaceText(lastUpdated.value, `"${now}"`);

				if (typeof lastUpdated.value.value !== 'string' || !lastUpdated.value.value.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
					context.report({
						node: lastUpdated.value,
						message: `lastUpdated field must be a string in YYYY-MM-DD HH:MM:SS format`,
						fix,
					});
					return;
				}

				if (translator.lastUpdated && translator.lastUpdated > lastUpdated.value.value) {
					context.report({
						node: lastUpdated.value,
						message: `lastUpdated field must be updated to be > ${translator.lastUpdated} to push to clients`,
						fix,
					});
				}
			}
		};
	},
};
