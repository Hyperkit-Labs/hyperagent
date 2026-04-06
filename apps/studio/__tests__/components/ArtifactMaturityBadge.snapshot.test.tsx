/**
 * Snapshot only for stable label copy (maturity taxonomy), not full pages.
 */
import { render } from "@testing-library/react";

import { ArtifactMaturityBadge } from "@/components/workflows/ArtifactMaturityBadge";
import type { Workflow } from "@/lib/types";

function wfWithMaturity(
  m: NonNullable<Workflow["artifact_maturity"]>,
): Workflow {
  return {
    workflow_id: "snap-wf",
    status: "building",
    artifact_maturity: m,
  } as Workflow;
}

describe("ArtifactMaturityBadge", () => {
  it.each([
    ["draft", "Draft"],
    ["validated", "Validated"],
    ["production_ready", "Production-ready"],
    ["blocked", "Blocked"],
  ] as const)("matches snapshot for %s", (maturity) => {
    const { container } = render(
      <ArtifactMaturityBadge workflow={wfWithMaturity(maturity)} />,
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
