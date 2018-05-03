module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module'
    },
    rules: {
        indent: ['error', 'tab'],
        'linebreak-style': ['error', 'unix'],
        quotes: ['error', 'single'],
        semi: ['error', 'always'],
        'no-trailing-spaces': ['error'],
        'max-len': [
            'error',
            {
                'code': 150,
                'ignoreTrailingComments': true,
                'ignoreUrls': true,
                'ignoreStrings': true,
                'ignoreTemplateLiterals': true,
                'ignoreRegExpLiterals': true,
            },
        ],
        "prefer-const":"error",
        "no-var":"error",
        "prefer-arrow-callback": "error"
    }
};