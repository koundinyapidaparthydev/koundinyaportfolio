import type { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({ dir: "./" });

const customConfig: Config = {
  testEnvironment: "jest-environment-jsdom",
  // jest.setup.ts runs after the test framework is installed in the environment
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    // Support the @/* path alias defined in tsconfig.json
    "^@/(.*)$": "<rootDir>/$1",
    // Stub out CSS / image imports so they don't break non-visual tests
    "^.+\\.(css|sass|scss)$": "<rootDir>/__mocks__/fileMock.ts",
    "^.+\\.(png|jpg|jpeg|gif|webp|svg|ico)$": "<rootDir>/__mocks__/fileMock.ts",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/cypress/"],
  transform: {
    // Use next/babel which already includes preset-env, preset-react, preset-typescript
    "^.+\\.(t|j)sx?$": ["babel-jest", { presets: ["next/babel"] }],
  },
  collectCoverageFrom: [
    "hooks/useTypewriter.ts",
    "lib/resumeStore.ts",
    "lib/emailNotification.ts",
    "lib/visitorStore.ts",
    "app/api/resume/route.ts",
    "app/api/contact/route.ts",
    "app/api/track/route.ts",
    "app/api/visitors/route.ts",
    "lib/store.ts",
    "components/sections/Hero.tsx",
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 85, lines: 85, statements: 85 },
  },
};

export default createJestConfig(customConfig);
