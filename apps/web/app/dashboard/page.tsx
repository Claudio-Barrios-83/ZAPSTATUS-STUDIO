import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./ui";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: jobs } = await supabase
    .from("video_jobs")
    .select("id,status,plan,created_at,error_message")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem" }}>Panel</h1>
      <p className="muted">
        <Link href="/">Inicio</Link>
      </p>
      <DashboardClient userId={user.id} initialJobs={jobs ?? []} />
    </div>
  );
}
