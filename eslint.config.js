import globals from 'globals';
import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		rules: {
			'array-bracket-spacing': [
				'error',
				'never'
			],
			'arrow-spacing': [
				'error'
			],
			'brace-style': [
				'error'
			],
			'comma-spacing': [
				'error'
			],
			'curly': [
				'error'
			],
			'dot-notation': [
				'error'
			],
			'eqeqeq': [
				'error'
			],
			'indent': [
				'error',
				'tab',
				{
					'SwitchCase': 1
				}
			],
			'keyword-spacing': [
				'error'
			],
			'linebreak-style': [
				'error',
				'unix'
			],
			'max-len': [
				'error',
				{
					'code': 150,
					'ignoreTrailingComments': true,
					'ignoreUrls': true,
					'ignoreStrings': true,
					'ignoreTemplateLiterals': true,
					'ignoreRegExpLiterals': true
				}
			],
			'no-console': [
				'warn'
			],
			'no-mixed-spaces-and-tabs': [
				'error'
			],
			'no-shadow': [
				'error'
			],
			'no-throw-literal': [
				'error'
			],
			'no-trailing-spaces': [
				'error'
			],
			'no-useless-call': [
				'error'
			],
			'no-unused-vars': [
				'error',
				{
					'args': 'none'
				}
			],
			'no-var': [
				'error'
			],
			'no-with': [
				'error'
			],
			'object-curly-spacing': [
				'error',
				'never'
			],
			'operator-linebreak': [
				'error'
			],
			'prefer-arrow-callback': [
				'error'
			],
			'prefer-const': [
				'error'
			],
			'quotes': [
				'error',
				'single'
			],
			'semi': [
				'error',
				'always'
			],
			'spaced-comment': [
				'error',
				'always'
			],
			'space-before-blocks': [
				'error',
				{
					'functions': 'always',
					'keywords': 'always',
					'classes': 'always'
				}
			],
			'space-infix-ops': [
				'error'
			],
			'space-in-parens': [
				'error',
				'never'
			],
			'yoda': [
				'error'
			]
		},
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
			globals: {
				...globals.mocha, ...globals.es2021, ...globals.node
			}
		}
	}
];
