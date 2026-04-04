/**
 * Lint/format staged files. Studio: ESLint + Prettier on staged paths only so a commit is not
 * blocked by unrelated files in the same package. Other workspaces: keep Turbo (full-package) tasks.
 */
const path = require("path");

function normalizePosix(filePath) {
  return path.normalize(filePath).split(path.sep).join("/");
}

function quoteArg(p) {
  if (process.platform === "win32") {
    return p.includes(" ") ? `"${p}"` : p;
  }
  return p.includes(" ") ? `'${p.replace(/'/g, "'\\''")}'` : p;
}

module.exports = {
  "*.{ts,tsx,js,jsx,mjs,cjs,json,yml,yaml}": (filenames) => {
    if (filenames.length === 0) return [];

    const studioRel = [];
    const other = [];
    for (const f of filenames) {
      const n = normalizePosix(path.normalize(f));
      if (n.startsWith("apps/studio/")) {
        studioRel.push(n.slice("apps/studio/".length));
      } else {
        other.push(f);
      }
    }

    const cmds = [];

    if (studioRel.length > 0) {
      const args = studioRel.map(quoteArg).join(" ");
      cmds.push(
        `pnpm --filter hyperagent-studio exec eslint --max-warnings 999 --fix ${args}`,
      );
      const prettiMatch = studioRel.filter((r) =>
        /\.(ts|tsx|js|jsx|json|css|md)$/i.test(r),
      );
      if (prettiMatch.length > 0) {
        cmds.push(
          `pnpm --filter hyperagent-studio exec prettier --write ${prettiMatch.map(quoteArg).join(" ")}`,
        );
      }
    }

    if (other.length > 0) {
      cmds.push("pnpm turbo run lint format --continue");
    }

    return cmds;
  },
};
