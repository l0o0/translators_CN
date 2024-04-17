'use strict';

const fs = require('fs');
const path = require('path');

const { parsed } = require('../../processor').support;

module.exports = {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'disallow executable status on translators',
			category: 'Best Practices',
		},
	},

	create: function (context) {
		return {
			Program: function (node) {
				if (process.platform == 'win32') return; // X_OK always succeeds on Windows

				const filename = context.getFilename();
				if (!parsed(filename)) return; // only check translators

				try {
					fs.accessSync(filename, fs.constants.X_OK);
					context.report(node, `Translator '${path.basename(filename)}' should not be executable.`);
				}
				catch (err) {
				}
			}
		};
	},
};
