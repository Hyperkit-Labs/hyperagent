const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ERC8004_ADDRESSES,
  ERC8004_CHAIN_IDS,
  LLM_PROVIDERS,
  KeyMaterial,
  detectProviderFromKey,
  maskApiKey,
} = require("./index.js");

test("detectProviderFromKey maps supported provider key prefixes", () => {
  assert.equal(detectProviderFromKey("sk-ant-api-key"), "anthropic");
  assert.equal(detectProviderFromKey("sk-openai-key"), "openai");
  assert.equal(detectProviderFromKey("AIzaSyExample"), "google");
  assert.equal(detectProviderFromKey("unknown-key"), null);
});

test("maskApiKey redacts short and long values consistently", () => {
  assert.equal(maskApiKey("short"), "****");
  assert.equal(maskApiKey("sk-openai-1234567890"), "sk-op...7890");
});

test("KeyMaterial never serializes the raw key by accident", () => {
  const material = new KeyMaterial("sk-openai-1234567890");

  assert.equal(String(material), "[REDACTED]");
  assert.equal(material.toJSON(), "[REDACTED]");
  assert.equal(material.valueOf(), "[REDACTED]");
  assert.equal(material.getRawUnsafe(), "sk-openai-1234567890");
  assert.equal(material.masked, "sk-op...7890");
});

test("core constants expose the locked MVP chain and provider set", () => {
  assert.deepEqual(LLM_PROVIDERS, ["openai", "anthropic", "google"]);
  assert.equal(
    ERC8004_ADDRESSES.SKALE_BASE_SEPOLIA,
    "0x8004A818BFB912233c491871b3d84c89A494BD9e"
  );
  assert.equal(ERC8004_CHAIN_IDS.SKALE_BASE_SEPOLIA, 324705682);
});
