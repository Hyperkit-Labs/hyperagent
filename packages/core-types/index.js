"use strict";
/**
 * Shared request/response contracts for services and orchestrator clients.
 * Use these types in handlers and HTTP clients for explicit, consistent contracts.
 */
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _KeyMaterial_value;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyMaterial = exports.LLM_PROVIDERS = exports.ERC8004_CHAIN_IDS = exports.ERC8004_ADDRESSES = void 0;
exports.detectProviderFromKey = detectProviderFromKey;
exports.maskApiKey = maskApiKey;
// ---------------------------------------------------------------------------
// ERC-8004 Agent Identity Registry (deployed on-chain)
// ---------------------------------------------------------------------------
/**
 * Official ERC-8004 contract addresses. The identity registry is an ERC-1155
 * token contract where each agentId is a uint256 token ID.
 */
exports.ERC8004_ADDRESSES = {
    SKALE_BASE_SEPOLIA: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
};
exports.ERC8004_CHAIN_IDS = {
    SKALE_BASE_SEPOLIA: 324705682,
};
exports.LLM_PROVIDERS = ["openai", "anthropic", "google"];
function detectProviderFromKey(raw) {
    if (raw.startsWith("sk-ant-"))
        return "anthropic";
    if (raw.startsWith("sk-"))
        return "openai";
    if (/^AIza/.test(raw))
        return "google";
    return null;
}
function maskApiKey(raw) {
    if (raw.length <= 8)
        return "****";
    return `${raw.slice(0, 5)}...${raw.slice(-4)}`;
}
/**
 * Wraps sensitive key material so accidental serialization/logging
 * never reveals the raw value. Use getRawUnsafe() only at the point
 * of actual crypto or provider API usage.
 */
class KeyMaterial {
    constructor(value) {
        _KeyMaterial_value.set(this, void 0);
        __classPrivateFieldSet(this, _KeyMaterial_value, value, "f");
    }
    toString() {
        return "[REDACTED]";
    }
    toJSON() {
        return "[REDACTED]";
    }
    valueOf() {
        return "[REDACTED]";
    }
    getRawUnsafe() {
        return __classPrivateFieldGet(this, _KeyMaterial_value, "f");
    }
    get masked() {
        return maskApiKey(__classPrivateFieldGet(this, _KeyMaterial_value, "f"));
    }
}
exports.KeyMaterial = KeyMaterial;
_KeyMaterial_value = new WeakMap();
