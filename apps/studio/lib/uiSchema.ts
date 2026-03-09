/**
 * Chain-agnostic UI schema for contract interaction (OpenZeppelin UI Builder style).
 * Used by ContractUi and export/mini-app flow.
 */

export type UiActionParam = {
  name: string;
  type: string;
  required: boolean;
  widget?: "text" | "number" | "address" | "select";
};

export type UiAction = {
  id: string;
  label: string;
  kind: "read" | "write";
  fn: string;
  params: UiActionParam[];
  payable: boolean;
  network: number;
  executionMode: "eoa" | "erc4337" | "eip7702" | "relayer";
};

export type UiAppSchema = {
  name: string;
  description?: string;
  chainId: number;
  contractAddress: string;
  abi: unknown[];
  actions: UiAction[];
};
