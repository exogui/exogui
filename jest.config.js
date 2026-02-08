module.exports = {
    silent: true,
    projects: [
        {
            displayName: 'backend',
            preset: 'ts-jest',
            testEnvironment: 'node',
            testMatch: [
                '**/src/back/**/*.test.ts',
                '**/src/main/**/*.test.ts',
                '**/src/shared/**/*.test.ts'
            ],
            moduleNameMapper: {
                "^@shared(.*)$": "<rootDir>/src/shared/$1",
                "^@main(.*)$": "<rootDir>/src/main/$1",
                "^@renderer(.*)$": "<rootDir>/src/renderer/$1",
                "^@back(.*)$": "<rootDir>/src/back/$1",
                "^@tests(.*)$": "<rootDir>/tests/$1",
            },
        },
        {
            displayName: 'renderer',
            preset: 'ts-jest',
            testEnvironment: 'jsdom',
            testMatch: ['**/src/renderer/**/*.test.{ts,tsx}'],
            moduleNameMapper: {
                "^@shared(.*)$": "<rootDir>/src/shared/$1",
                "^@main(.*)$": "<rootDir>/src/main/$1",
                "^@renderer(.*)$": "<rootDir>/src/renderer/$1",
                "^@back(.*)$": "<rootDir>/src/back/$1",
                "^@tests(.*)$": "<rootDir>/tests/$1",
            },
        }
    ]
};
