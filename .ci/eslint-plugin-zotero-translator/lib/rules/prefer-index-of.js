'use strict';

module.exports = {
	meta: {
		type: 'suggestion',
		docs: {
			description: 'suggest alternative to unnecessary use of indexOf or search',
			category: 'Stylistic Issues',
		},
		fixable: 'code',
	},

	create: function (context) {
		return {
			"BinaryExpression > CallExpression:matches([callee.property.name='indexOf'], [callee.property.name='search'])[arguments.length=1]": (node) => {
				let source = context.getSourceCode();
				let binary = node.parent;
				if (
					(binary.operator.startsWith('==')
						|| binary.operator.startsWith('!=')
						|| binary.operator === '>') && source.getText(binary.right) === '-1'
					|| (binary.operator === '<' || binary.operator === '>=') && source.getText(binary.right) === '0'
				) {
					context.report({
						node,
						message: node.callee.property.name === 'indexOf'
							? "Unnecessary '.indexOf()', use '.includes()' instead"
							: "Unnecessary '.search()', use 'RegExp#test()' instead",
						*fix(fixer) {
							let test = node.callee.property.name === 'indexOf'
								? `${source.getText(node.callee.object)}.contains(${source.getText(node.arguments[0])})`
								: `${source.getText(node.arguments[0])}.test(${source.getText(node.callee.object)})`;
							let positiveMatch = binary.operator.startsWith('!=')
								|| binary.operator === '>'
								|| binary.operator === '>=';
							if (!positiveMatch) {
								// This might produce unnecessary parens, but unfortunately it's the best we can do
								test = `!(${test})`;
							}
							yield fixer.replaceText(binary, test);
						}
					});
				}
			}
		};
	},
};
