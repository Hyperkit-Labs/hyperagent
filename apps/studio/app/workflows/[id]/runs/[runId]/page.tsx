import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

type PageProps = { params: Promise<{ id: string; runId: string }> };

/**
 * Run detail is viewed in context on the chat page. Redirect to chat with workflow selected.
 */
export default async function WorkflowRunRedirectPage({ params }: PageProps) {
  const { id: workflowId } = await params;
  if (!workflowId) redirect(ROUTES.HOME);
  redirect(`${ROUTES.HOME}?workflow=${encodeURIComponent(workflowId)}`);
}
