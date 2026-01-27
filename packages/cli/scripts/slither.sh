#!/bin/bash

# Slither Wrapper for HyperAgent
# Usage: ./scripts/slither.sh path/to/contract.sol

if [ -z "$1" ]; then
  echo "Usage: $0 <contract_path>"
  exit 1
fi

CONTRACT_PATH=$1
CONTRACT_DIR=$(dirname "$CONTRACT_PATH")
CONTRACT_FILE=$(basename "$CONTRACT_PATH")

# Ensure the contract directory is absolute for Docker mounting
ABS_CONTRACT_DIR=$(cd "$CONTRACT_DIR" && pwd)

echo "Running Slither on $CONTRACT_FILE..."

# Using the official Slither docker image
# We mount the directory containing the contract to /share in the container
docker run --rm \
  -v "$ABS_CONTRACT_DIR":/share \
  trailofbits/eth-security-toolbox \
  bash -c "cd /share && slither $CONTRACT_FILE --json -" 2>/dev/null
