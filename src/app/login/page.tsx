import { redirect } from "next/navigation";
import LoginPanel from "@/components/LoginPanel";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/");

  return <LoginPanel />;
}
