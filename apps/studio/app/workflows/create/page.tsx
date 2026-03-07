import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

/**
 * Workflow creation is done on the chat page. Redirect /workflows/create to chat (home).
 */
export default function WorkflowCreateRedirectPage() {
  redirect(ROUTES.HOME);
}
