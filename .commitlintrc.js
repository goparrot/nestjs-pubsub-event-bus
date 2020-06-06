module.exports = {
    extends: ['@commitlint/config-conventional'],
    scopeOverrides: {
        fix: [{ name: 'style' }, { name: 'unit' }, { name: 'e2e' }, { name: 'integration' }],
    },
    allowCustomScopes: true,
};
