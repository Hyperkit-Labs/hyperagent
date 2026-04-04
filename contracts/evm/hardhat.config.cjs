/**
 * Hardhat dual stack: same Solidity sources as Foundry (`src/`).
 * Run from this directory: `pnpm exec hardhat compile` (after install).
 */
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test/hardhat",
    cache: "./cache_hardhat",
    artifacts: "./artifacts",
  },
};
