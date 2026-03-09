import { redirect } from "next/navigation";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/**
 * /chat redirects to / (chat is the default home experience). Query params are preserved.
 */
export default async function ChatRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const q = new URLSearchParams(params as Record<string, string>).toString();
  redirect(q ? `/?${q}` : "/");
}
