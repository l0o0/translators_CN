/**
 * @fileoverview Checks Zotero translators for errors and recommended style
 * @author Emiliano Heyns
 */

'use strict';

const requireDir = require('require-dir');

module.exports = {
	rules: requireDir('./lib/rules'),
	processors: {
		'.js': require('./lib/processor'),
	}
};
