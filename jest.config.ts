import type { JestConfigWithTsJest } from 'ts-jest';

const config: JestConfigWithTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/'],
    modulePathIgnorePatterns: ['dist', 'coverage'],
};

module.exports = config;
