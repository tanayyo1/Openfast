/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: "server",
      preset: "ts-jest",
      testEnvironment: "node",
      setupFilesAfterEnv: ["<rootDir>/tests/jest.setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      testPathIgnorePatterns: [
        "/node_modules/",
        "/.next/",
        "/tests/e2e/",
        "/tests/unit/components/",
      ],
    },
    {
      displayName: "components",
      preset: "ts-jest",
      testEnvironment: "jsdom",
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
      testMatch: ["<rootDir>/tests/unit/components/**/*.test.{ts,tsx}"],
      transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
      },
    },
  ],
};
