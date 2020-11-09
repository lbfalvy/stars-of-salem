module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: [
    '@typescript-eslint',
    'import'
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  settings: {
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx']
    },
    'import/resolver': {
      // use <root>/tsconfig.json
      'typescript': {
        'alwaysTryTypes': true // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
      },
    },
  },
  overrides: [
    {
      // enable the rule specifically for TypeScript files
      files: ['*.ts', '*.tsx'],
      rules: {
        "@typescript-eslint/explicit-member-accessibility": ["error"]
      }
    }
  ],
  rules: {
    'brace-style': 'warn',
    curly: 'warn',
    semi: 'warn',
    "no-unused-vars": "off",
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', {
      varsIgnorePattern: '^_'
    }],
    '@typescript-eslint/naming-convention': ['error',
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'memberLike', modifiers: ['public'], format: ['camelCase'] },
      { selector: 'memberLike', modifiers: ['private'], format: ['camelCase'], leadingUnderscore: 'allow' }
    ],
    'max-len': ['error', {
      code: 100,
      ignoreUrls: true,
      ignoreStrings: true,
      ignoreTemplateLiterals: true,
      ignoreRegExpLiterals: true
    }],
    indent: ['warn', 4, {
      FunctionDeclaration: { parameters: 'first' },
      FunctionExpression: { parameters: 'first' },
      CallExpression: { arguments:'first' },
      ArrayExpression: 'first',
      ObjectExpression: 'first',
      ignoreComments: true,
      MemberExpression: 'off'
    }]
  },
  env: {
    node: true,
    es2017: true
  }
};