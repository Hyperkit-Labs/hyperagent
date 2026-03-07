import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

type PageProps = { params: Promise<{ id: string }> };

/**
 * Workflow detail is shown on the chat page. Redirect /workflows/[id] to chat with workflow selected.
 */
export default async function WorkflowIdRedirectPage({ params }: PageProps) {
  const { id } = await params;
  if (!id) redirect(ROUTES.HOME);
  redirect(`${ROUTES.HOME}?workflow=${encodeURIComponent(id)}`);
}
