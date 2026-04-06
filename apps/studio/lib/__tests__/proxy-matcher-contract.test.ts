import fs from "node:fs";
import path from "node:path";

/** Raw inner text of a TS/JS double-quoted string starting at openQuoteIndex (points at `"`). */
function readDoubleQuotedInner(src: string, openQuoteIndex: number): string {
  if (src[openQuoteIndex] !== '"') {
    throw new Error("expected opening double quote");
  }
  let i = openQuoteIndex + 1;
  let inner = "";
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") {
      inner += src.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '"') {
      return inner;
    }
    inner += ch;
    i += 1;
  }
  throw new Error("unterminated string literal");
}

describe("proxy matcher contract", () => {
  it("proxy.ts config.matcher[0] matches studio-proxy-config STUDIO_PROXY_MATCHER_PATTERN (source)", () => {
    const proxyPath = path.join(__dirname, "..", "..", "proxy.ts");
    const cfgPath = path.join(__dirname, "..", "studio-proxy-config.ts");
    const proxySrc = fs.readFileSync(proxyPath, "utf8");
    const cfgSrc = fs.readFileSync(cfgPath, "utf8");

    const matcherIdx = proxySrc.indexOf("matcher:");
    expect(matcherIdx).toBeGreaterThanOrEqual(0);
    const bracketIdx = proxySrc.indexOf("[", matcherIdx);
    expect(bracketIdx).toBeGreaterThanOrEqual(0);
    const proxyOpen = proxySrc.indexOf('"', bracketIdx);
    const proxyInner = readDoubleQuotedInner(proxySrc, proxyOpen);

    const patIdx = cfgSrc.indexOf("STUDIO_PROXY_MATCHER_PATTERN");
    expect(patIdx).toBeGreaterThanOrEqual(0);
    const eqIdx = cfgSrc.indexOf("=", patIdx);
    const cfgOpen = cfgSrc.indexOf('"', eqIdx);
    const cfgInner = readDoubleQuotedInner(cfgSrc, cfgOpen);

    expect(proxyInner).toBe(cfgInner);
  });
});
