import { redirect } from "next/navigation";
import Dashboard from "@/components/Dashboard";
import { mockUser } from "@/lib/mock";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const isMock = process.env.DROPS_MOCK === "1";

  if (isMock) {
    return <Dashboard user={mockUser} />;
  }

  const session = await readSession();
  if (!session) redirect("/login");

  return (
    <Dashboard
      user={{
        id: session.userId,
        login: session.login,
        displayName: session.displayName,
        avatarUrl: session.avatarUrl,
      }}
    />
  );
}
