'use strict';

const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');

const { repo, parsed, header, IDconflict } = require('../../processor').support;

const deleted = new Set(
	fs.readFileSync(path.join(repo, 'deleted.txt'), 'utf-8')
		.split('\n')
		.map(line => line.split(' ')[0])
		.filter(id => id && id.indexOf('-') > 0)
);

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: 'disallows translatorID re-use',
			category: 'Potential Problems',
		},
		fixable: 'code',
	},

	create: function (context) {
		return {
			Program: function (node) {
				const filename = context.getFilename();
				const translator = parsed(filename);
				if (!translator || !translator.header.fields) return; // regular js source, or header is invalid

				const translatorID = header(node).properties.find(p => p.key.value === 'translatorID');

				if (!translatorID || !translatorID.value.value) {
					context.report({
						node: header(node),
						message: 'Header has no translator ID',
					});
					return;
				}

				if (deleted.has(translatorID.value.value)) {
					context.report({
						node: translatorID.value,
						message: 'Header re-uses translator ID of deleted translator',
						fix: function (fixer) {
							return fixer.replaceText(translatorID.value, `"${uuid()}"`);
						}
					});
					return;
				}

				const conflict = IDconflict(filename);
				if (conflict) {
					context.report({
						node: translatorID.value,
						message: `re-uses translator ID of ${conflict.label}`,
						fix: fixer => fixer.replaceText(translatorID.value, `"${uuid()}"`),
					});
				}
			}
		};
	}
};
