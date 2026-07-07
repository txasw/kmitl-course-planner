// Conventional Commits with a 72 character header limit. Authored as .mjs so it
// loads without a TypeScript loader on every platform.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 72],
  },
};
