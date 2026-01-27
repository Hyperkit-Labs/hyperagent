/* eslint-disable @typescript-eslint/no-explicit-any */

export type CompiledContract = {
  contractName: string;
  abi: any[];
  bytecode: `0x${string}`;
  deployedBytecode?: `0x${string}`;
  warnings: string[];
};

export function compileSolidity(args: {
  sourceCode: string;
  contractName?: string;
}): CompiledContract {
  // solc has inconsistent TS types; use require for CommonJS compatibility.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const solc = require("solc") as any;

  const input = {
    language: "Solidity",
    sources: {
      "Contract.sol": { content: args.sourceCode },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"],
        },
      },
    },
  };

  const outputRaw = solc.compile(JSON.stringify(input));
  const output = JSON.parse(outputRaw) as any;

  const warnings: string[] = [];
  const errors: string[] = [];

  for (const e of output.errors ?? []) {
    const msg = e.formattedMessage || e.message || String(e);
    if (e.severity === "error") {
      errors.push(msg);
    } else {
      warnings.push(msg);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Solidity compile failed:\n${errors.slice(0, 10).join("\n")}`);
  }

  const contractsForFile = output.contracts?.["Contract.sol"];
  if (!contractsForFile || typeof contractsForFile !== "object") {
    throw new Error("Solidity compile produced no contracts");
  }

  const availableNames = Object.keys(contractsForFile);
  if (availableNames.length === 0) {
    throw new Error("Solidity compile produced no contract entries");
  }

  const picked = args.contractName && contractsForFile[args.contractName]
    ? args.contractName
    : availableNames[0];

  const c = contractsForFile[picked];
  const abi = c.abi ?? [];
  const bytecodeObj = c.evm?.bytecode?.object ?? "";
  const deployedBytecodeObj = c.evm?.deployedBytecode?.object ?? "";

  if (!bytecodeObj || typeof bytecodeObj !== "string") {
    throw new Error("Compilation output missing bytecode");
  }

  const bytecode = (`0x${bytecodeObj}`) as `0x${string}`;
  const deployedBytecode = deployedBytecodeObj
    ? ((`0x${deployedBytecodeObj}`) as `0x${string}`)
    : undefined;

  return {
    contractName: picked,
    abi,
    bytecode,
    deployedBytecode,
    warnings: warnings.slice(0, 50),
  };
}
