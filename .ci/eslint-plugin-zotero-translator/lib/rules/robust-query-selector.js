'use strict';

module.exports = {
	meta: {
		type: 'suggest',
		docs: {
			description: 'suggest alternatives to brittle querySelector() strings',
		},
		fixable: 'code',
	},

	create: function (context) {
		return {
			"CallExpression:matches([callee.property.name=/querySelector(All)?/], [callee.name=/attr|text|innerText/])[arguments.0.type=Literal]": (node) => {
				let arg = node.arguments[0].raw;
				if (typeof arg !== 'string') {
					return;
				}
				let idRe = /\[id=(["'])([^"'.#\s]+)\1]/g;
				if (idRe.test(arg)) {
					context.report({
						node,
						message: "Prefer #id over [id=\"id\"]",
						*fix(fixer) {
							yield fixer.replaceText(node.arguments[0], arg.replaceAll(idRe, "#$2"));
						}
					});
				}
				let classRe = /\[class=(["'])([^"'.#]+)\1]/g;
				if (classRe.test(arg)) {
					context.report({
						node,
						message: "Prefer .class over [class=\"class\"]",
						*fix(fixer) {
							yield fixer.replaceText(node.arguments[0],
								arg.replaceAll(classRe, (_, __, name) => `.${name.replaceAll(/\s+/g, '.')}`));
						}
					});
				}
			}
		};
	},
};
