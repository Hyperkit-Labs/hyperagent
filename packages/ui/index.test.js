const test = require("node:test");
const assert = require("node:assert/strict");

const { PLACEHOLDER_PACKAGE_MESSAGE } = require("./index.js");

test("@hyperagent/shared-ui exposes an explicit placeholder contract", () => {
  assert.match(PLACEHOLDER_PACKAGE_MESSAGE, /roadmap placeholder/i);
  assert.match(PLACEHOLDER_PACKAGE_MESSAGE, /no supported runtime exports yet/i);
});
