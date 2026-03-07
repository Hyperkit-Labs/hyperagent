/**
 * OpenZeppelin Contracts Wizard: generate Solidity source from kind + options.
 * Uses @openzeppelin/wizard programmatic API. Returns { filename: source }.
 */
import { erc20, erc721, erc1155 } from "@openzeppelin/wizard";

export const WIZARD_KINDS = ["erc20", "erc721", "erc1155"] as const;
export type WizardKind = (typeof WIZARD_KINDS)[number];

const ALLOWED_OPTION_KEYS: Record<string, Set<string>> = {
  erc20: new Set(["name", "symbol", "burnable", "mintable", "pausable", "permit", "votes", "flashMinting", "upgradeable"]),
  erc721: new Set(["name", "symbol", "baseUri", "uri", "mintable", "burnable", "pausable", "permit", "votes", "upgradeable"]),
  erc1155: new Set(["name", "uri", "baseUri", "burnable", "pausable", "mintable", "supply", "upgradeable"]),
};

function filterOptions(kind: string, options: OzWizardOptions): OzWizardOptions {
  const allowed = ALLOWED_OPTION_KEYS[kind] ?? ALLOWED_OPTION_KEYS.erc20;
  const out: OzWizardOptions = {};
  for (const [k, v] of Object.entries(options)) {
    if (allowed.has(k)) out[k] = v;
  }
  return out;
}

export interface OzWizardOptions {
  name?: string;
  symbol?: string;
  baseUri?: string;
  uri?: string;
  mintable?: boolean;
  burnable?: boolean;
  pausable?: boolean;
  permit?: boolean;
  votes?: boolean;
  flashMinting?: boolean;
  upgradeable?: boolean | string;
  supply?: boolean;
  [key: string]: unknown;
}

function asErc20Opts(opts: OzWizardOptions): Parameters<typeof erc20.print>[0] {
  const o: Record<string, unknown> = {
    name: opts.name ?? "MyToken",
    symbol: opts.symbol ?? "MTK",
    burnable: opts.burnable ?? false,
    mintable: opts.mintable ?? false,
    pausable: opts.pausable ?? false,
    permit: opts.permit ?? false,
    votes: opts.votes ?? false,
    flashMinting: opts.flashMinting ?? false,
    upgradeable: typeof opts.upgradeable === "string" ? opts.upgradeable : (opts.upgradeable ?? false),
  };
  return o as unknown as Parameters<typeof erc20.print>[0];
}

function asErc721Opts(opts: OzWizardOptions): Parameters<typeof erc721.print>[0] {
  const o: Record<string, unknown> = {
    name: opts.name ?? "MyToken",
    symbol: opts.symbol ?? "MTK",
    baseUri: opts.baseUri ?? opts.uri ?? "",
    mintable: opts.mintable ?? true,
    burnable: opts.burnable ?? false,
    pausable: opts.pausable ?? false,
    permit: opts.permit ?? false,
    votes: opts.votes ?? false,
    upgradeable: typeof opts.upgradeable === "string" ? opts.upgradeable : (opts.upgradeable ?? false),
  };
  return o as unknown as Parameters<typeof erc721.print>[0];
}

function asErc1155Opts(opts: OzWizardOptions): Parameters<typeof erc1155.print>[0] {
  const o: Record<string, unknown> = {
    name: opts.name ?? "MyToken",
    uri: opts.baseUri ?? opts.uri ?? "",
    burnable: opts.burnable ?? false,
    pausable: opts.pausable ?? false,
    mintable: opts.mintable ?? true,
    supply: opts.supply ?? true,
    upgradeable: typeof opts.upgradeable === "string" ? opts.upgradeable : (opts.upgradeable ?? false),
  };
  return o as unknown as Parameters<typeof erc1155.print>[0];
}

export function generateFromWizard(kind: string, options: OzWizardOptions): Record<string, string> {
  const k = kind.toLowerCase();
  if (!WIZARD_KINDS.includes(k as WizardKind)) {
    throw new Error(`kind must be one of ${WIZARD_KINDS.join(", ")}`);
  }
  const opts = filterOptions(k, options || {});
  let source: string;
  if (k === "erc20") {
    source = erc20.print(asErc20Opts(opts));
  } else if (k === "erc721") {
    source = erc721.print(asErc721Opts(opts));
  } else {
    source = erc1155.print(asErc1155Opts(opts));
  }
  const filename = k === "erc1155" ? "Contract1155.sol" : k === "erc721" ? "Contract721.sol" : "Contract.sol";
  return { [filename]: source };
}
