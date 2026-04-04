import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactMaturityBadge } from "./ArtifactMaturityBadge";
import type { Workflow } from "@/lib/types";

const base: Workflow = {
  workflow_id: "wf-story",
  status: "running",
  artifact_maturity: "draft",
};

const meta: Meta<typeof ArtifactMaturityBadge> = {
  title: "Workflows/ArtifactMaturityBadge",
  component: ArtifactMaturityBadge,
};

export default meta;

type Story = StoryObj<typeof ArtifactMaturityBadge>;

export const Draft: Story = {
  args: { workflow: { ...base, artifact_maturity: "draft" } },
};

export const Validated: Story = {
  args: { workflow: { ...base, artifact_maturity: "validated" } },
};

export const ProductionReady: Story = {
  args: { workflow: { ...base, artifact_maturity: "production_ready" } },
};

export const Blocked: Story = {
  args: { workflow: { ...base, artifact_maturity: "blocked" } },
};
