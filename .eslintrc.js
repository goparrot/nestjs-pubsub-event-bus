/**
 * @type {import('eslint').Linter.Config}
 */
module.exports = {
    extends: ['@goparrot/eslint-config/recommended', '@goparrot/eslint-config/less-strict', 'plugin:jest/recommended', 'plugin:jest/style'],
    parserOptions: {
        project: './tsconfig.eslint.json',
    },
    rules: {
        // rules to override.
        '@typescript-eslint/no-unnecessary-condition': 'error',
        '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
};
