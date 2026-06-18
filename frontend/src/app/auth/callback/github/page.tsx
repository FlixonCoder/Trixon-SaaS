"use client";
import { useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function GitHubCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const processed = useRef(false);
  const supabase = createClient();

  useEffect(() => {
    if (!code || processed.current) return;
    processed.current = true;

    const connectGitHub = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("No active session");
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/vcs/github/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code }),
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new Error(error.detail || "Failed to connect GitHub");
        }

        const data = await res.json();

        // Successfully connected! Go back to onboarding step 2 with the connection ID
        // This avoids needing to fetch the vcs_connection on the next page which might fail due to RLS delays
        router.replace(`/onboarding?step=2&vcs_id=${data.id}&platform=${data.platform}`);
      } catch (err) {
        console.error("GitHub connection error:", err);
        alert(err instanceof Error ? err.message : "Failed to connect GitHub");
        router.replace("/onboarding?step=2");
      }
    };

    connectGitHub();
  }, [code, router, supabase]);

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F4]">
        <div className="text-center">
          <h1 className="text-xl font-bold text-[#1e1b1b] mb-2">Invalid Callback</h1>
          <p className="text-[#837e80] mb-4">No authorization code found in URL.</p>
          <button
            onClick={() => router.replace("/onboarding?step=2")}
            className="text-[#18181b] hover:underline"
          >
            Return to onboarding
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F4F4]">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#18181b] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#1e1b1b] mb-2">Connecting GitHub...</h1>
        <p className="text-[#837e80]">Please wait while we secure your connection.</p>
      </div>
    </div>
  );
}

export default function GitHubCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F6F4F4]">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#18181b] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#1e1b1b] mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <GitHubCallback />
    </Suspense>
  );
}
