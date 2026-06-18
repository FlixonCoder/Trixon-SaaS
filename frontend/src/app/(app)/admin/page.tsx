import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";
import { AdminDashboardClient } from "./admin-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) redirect("/login");

  // Check admin status
  let isAdmin = false;
  try {
    const profile = await api.getProfile(session.access_token);
    isAdmin = !!profile?.is_admin;
    console.log("ADMIN_PAGE_SESSION: email =", session.user.email, "id =", session.user.id, "isAdmin =", isAdmin);
  } catch (err) {
    console.error("Failed to fetch profile in admin page:", err);
  }

  if (!isAdmin) {
    redirect("/dashboard");
  }

  // Fetch all metrics concurrently
  const [
    overview,
    signupsTimeseries,
    featureAdoption,
    mostViewedReports,
    healthScoreDist,
    recentActivity,
  ] = await Promise.all([
    api.getAdminOverview(session.access_token),
    api.getAdminSignupsTimeseries(session.access_token),
    api.getAdminFeatureAdoption(session.access_token),
    api.getAdminMostViewedReports(session.access_token),
    api.getAdminHealthScoreDistribution(session.access_token),
    api.getAdminRecentActivity(session.access_token),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-obsidian font-display">
          Admin Dashboard
        </h1>
        <p className="text-ash mt-2">
          Usage analytics and platform metrics.
        </p>
      </div>

      <AdminDashboardClient 
        overview={overview}
        signupsTimeseries={signupsTimeseries}
        featureAdoption={featureAdoption}
        mostViewedReports={mostViewedReports}
        healthScoreDist={healthScoreDist}
        recentActivity={recentActivity}
      />
    </div>
  );
}
