import type { InitialOptionsTsJest } from 'ts-jest/dist/types';

const config: InitialOptionsTsJest = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/'],
    modulePathIgnorePatterns: ['dist', 'coverage'],
};

module.exports = config;
