'use strict';

const translators = require('../translators');
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
				const header = translators.getHeaderFromAST(node);
				if (!header.body) return; // if there's no file header, assume it's not a translator
				if (!header.followingStatement) return; // if there's no following statement, there's more significant problems than just the license missing

				const options = context.options[0];
				if (!options.mustMatch) throw new Error('mustMatch not set');

				let firstComment = null;
				let copyright = null;
				for (const comment of context.getSourceCode().getAllComments()) {
					if (comment.loc.start.line <= header.body.loc.end.line) continue; // skip decorator comments

					if (comment.value.includes(options.mustMatch)) {
						if (firstComment || comment.loc.start.line > header.followingStatement.start.line) {
							context.report({
								loc: comment.loc,
								message: 'Preferred to have license block at the top'
							});
						}
						return;
					}

					if (comment.value.match(/copyright/i)) {
						copyright = comment;
					}

					firstComment = firstComment || comment;
				}
				if (copyright) {
					context.report({
						loc: copyright.loc,
						message: `Copyright preferred to be ${options.mustMatch}`,
					});
					return;
				}

				if (!options.templateFile) throw new Error('templateFile not set');
				const templateFile = fs.existsSync(options.templateFile)
					? options.templateFile
					: path.resolve(path.join(findRoot(context.getFilename()), options.templateFile));
				if (!fs.existsSync(templateFile)) throw new Error(`cannot find ${templateFile}`);
				const template = fs.readFileSync(templateFile, 'utf-8');

				copyright = {
					holder: header.properties.creator ? header.properties.creator.value : null,
					period: `${(new Date).getFullYear()}`,
				};
				if (header.properties.lastUpdated) {
					const year = header.properties.lastUpdated.value.split('-')[0] || '';
					if (year && year !== copyright.period) copyright.period = `${year}-${copyright.period}`;
				}
				const licenseText = '\n\n' + template.trim().replace(/\${(.*?)\}/g, (_, id) => {
					id = id.trim();
					return copyright[id] || `<undefined '${id}'>`;
				}) + '\n\n';

				context.report({
					node: header.followingStatement,
					message: "Missing license block",
					fix: (firstComment && firstComment.type === 'Block')
						? undefined
						: fixer => fixer.insertTextBefore(header.followingStatement, licenseText),
				});
			}
		};
	},
};
