import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import InviteForm from "./invite-form";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const { token } = params;

  // Verify token
  const result = await db.execute({
    sql: "SELECT id, email, username FROM users WHERE invite_token = ? AND invite_expires > CURRENT_TIMESTAMP",
    args: [token]
  });

  if (result.rows.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Invalid or Expired Invite</h1>
          <p className="text-zinc-500">This invitation link is no longer valid.</p>
        </div>
      </div>
    );
  }

  const user = result.rows[0];

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Welcome to Dainiki</h1>
          <p className="text-sm text-zinc-500">Set up your secure credentials to continue.</p>
        </div>
        <InviteForm token={token} email={user.email as string} />
      </div>
    </div>
  );
}
