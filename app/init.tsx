import { initDb } from "@/lib/db";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Initialize DB tables if they don't exist
  // This is safe for Turso and local libSQL
  await initDb();

  return children;
}
