module.exports = {
    extends: ['@goparrot/eslint-config/recommended', '@goparrot/eslint-config/less-strict'],
    parserOptions: {
        project: './tsconfig.eslint.json',
    },
    rules: {
        // rules to override.
        '@typescript-eslint/no-unnecessary-condition': 'error',
    },
};
