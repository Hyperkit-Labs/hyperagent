import { redirect } from "next/navigation";
import { ROUTES } from "@/constants/routes";

export default function MarketplacePage() {
  redirect(ROUTES.TEMPLATES);
}
