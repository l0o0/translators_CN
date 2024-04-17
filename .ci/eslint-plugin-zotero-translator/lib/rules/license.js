'use strict';

const { parsed } = require('../../processor').support;
const findRoot = require("find-root");
const fs = require('fs');
const path = require('path');

module.exports = {
	meta: {
		type: 'problem',
		fixable: 'code',
		docs: {
			description: 'checks for AGPL license',
			category: 'Possible Errors',
		},
	},

	create: function (context) {
		return {
			Program: function (node) {
				const translator = parsed(context.getFilename());

				if (!translator) return; // regular js source

				if (node.body.length < 2) return; // no body?

				const options = context.options[0];
				if (!options.mustMatch) throw new Error('license/mustMatch not set');
				if (!options.templateFile) throw new Error('license/templateFile not set');

				const license = context.getSourceCode().getAllComments().find((comment) => {
					return comment.type === 'Block' && comment.value.match(/(BEGIN LICENSE BLOCK[\s\S]+END LICENSE BLOCK)|(Copyright)/i);
				});

				if (!license) {
					const properties = translator.header.fields;
					const copyright = {
						holder: properties.creator || 'Zotero Contributors',
						period: `${(new Date).getFullYear()}`,
					};
					if (properties.lastUpdated) {
						const year = properties.lastUpdated.split('-')[0] || '';
						if (year && year !== copyright.period) copyright.period = `${year}-${copyright.period}`;
					}

					const templateFile = fs.existsSync(options.templateFile)
						? options.templateFile
						: path.resolve(path.join(findRoot(context.getFilename()), options.templateFile));
					if (!fs.existsSync(templateFile)) throw new Error(`cannot find ${templateFile}`);
					const template = fs.readFileSync(templateFile, 'utf-8');

					const licenseText = '\n\n' + template.trim().replace(/\${(.*?)\}/g, (_, id) => {
						id = id.trim();
						return copyright[id] || `<undefined '${id}'>`;
					}) + '\n\n';
					context.report({
						message: 'Missing license block',
						loc: node.body[1].loc.start,
						fix: fixer => fixer.insertTextBefore(node.body[1], licenseText),
					});
					return;
				}

				if (node.body.length > 2 && node.body[1].loc.start.line < license.loc.start.line) {
					context.report({
						loc: license.loc,
						message: 'Preferred to have license block at the top'
					});
					return;
				}

				if (!license.value.match(new RegExp(options.mustMatch))) {
					context.report({
						loc: license.loc,
						message: `Copyright preferred to be ${options.mustMatch}`,
					});
				}
			}
		};
	},
};
