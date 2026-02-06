/**
 * Compilation adapter for Solidity contracts
 * Provides interface for compiling Solidity source to bytecode
 * 
 * Note: Actual compilation may be done via external service or API
 * This adapter provides a consistent interface
 */

export interface CompilationResult {
  bytecode: string;
  abi: any[];
  contractName: string;
  warnings?: string[];
}

export interface CompilationOptions {
  sourceCode: string;
  contractName?: string;
}

/**
 * Compile Solidity source code to bytecode
 * 
 * This is a placeholder that expects bytecode to be provided via meta
 * or calls an external compilation service.
 * 
 * For full implementation, integrate with:
 * - solc compiler (requires adding solc dependency)
 * - External compilation API (ts/api compile endpoint)
 * - Or assume compilation happens in a previous node
 */
export async function compileContract(
  options: CompilationOptions,
): Promise<CompilationResult> {
  // For now, throw error if source code is provided without bytecode
  // In production, this would:
  // 1. Call external compilation API (ts/api)
  // 2. Or use solc directly if available
  // 3. Or assume bytecode is already in state.meta
  
  throw new Error(
    "Compilation not implemented in orchestrator. " +
    "Contract must be pre-compiled or compilation must happen via external service. " +
    "To enable compilation, add solc dependency or integrate with compilation API."
  );
}

/**
 * Check if source code needs compilation
 */
export function needsCompilation(sourceCode: string): boolean {
  // If source code doesn't look like bytecode (starts with 0x and is hex), it needs compilation
  if (!sourceCode.trim().startsWith("0x")) {
    return true;
  }
  
  // Check if it's valid hex (bytecode)
  const hexPattern = /^0x[0-9a-fA-F]+$/;
  return !hexPattern.test(sourceCode.trim());
}

