// Must run before next/jest loads (ESM jest.config.ts hoists imports above this).
process.env.NODE_ENV = "test";

const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const customConfig = {
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^.+\\.(css|sass|scss)$": "<rootDir>/__mocks__/fileMock.ts",
    "^.+\\.(png|jpg|jpeg|gif|webp|svg|ico)$": "<rootDir>/__mocks__/fileMock.ts",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/cypress/"],
  transform: {
    "^.+\\.(t|j)sx?$": ["babel-jest", { presets: ["next/babel"] }],
  },
  collectCoverageFrom: [
    "hooks/useTypewriter.ts",
    "lib/resumeStore.ts",
    "app/api/resume/route.ts",
    "app/api/contact/route.ts",
    "lib/store.ts",
    "components/sections/Hero.tsx",
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  },
};

module.exports = createJestConfig(customConfig);
