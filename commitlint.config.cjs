module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => /^Merge (branch|pull request)/.test(message.trim())],
  rules: {
    "body-max-line-length": [0],
  },
};
