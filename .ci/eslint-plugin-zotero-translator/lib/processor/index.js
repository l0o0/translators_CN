'use strict';

const translators = require('../translators').cache;

module.exports = {
	preprocess: function (text, filename) {
		const translator = translators.get(filename);

		return [(typeof translator.source === 'string') ? translator.source : text];
	},

	postprocess: function (messages, _filename) {
		return messages[0];
	},
};
