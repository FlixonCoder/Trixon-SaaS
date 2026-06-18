import Link from "next/link";
import Image from "next/image";
import { LogOut, Settings, LayoutDashboard, FolderGit2, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  let isAdmin = false;
  if (session) {
    try {
      const profile = await api.getProfile(session.access_token);
      isAdmin = !!profile?.is_admin;
      console.log("LAYOUT_SESSION: email =", session.user.email, "id =", session.user.id, "isAdmin =", isAdmin);
    } catch (err) {
      console.error("Failed to fetch profile in layout:", err);
    }
  } else {
    console.log("LAYOUT_SESSION: No active session");
  }
  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Top Navigation */}
      <header className="bg-obsidian border-b border-obsidian-raised sticky top-0 z-40">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="flex-shrink-0">
                <Image
                  src="/light-logo.png"
                  alt="Trixon"
                  width={100}
                  height={26}
                  className="h-6 w-auto object-contain brightness-0 invert"
                />
              </Link>
              <nav className="flex space-x-2 sm:space-x-4 ml-4 sm:ml-0">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 sm:gap-2 text-sm font-medium text-paper bg-obsidian-raised px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md hover:bg-obsidian-deep transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline font-display">Projects</span>
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 sm:gap-2 text-sm font-medium text-paper bg-emerald-600 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md hover:bg-emerald-700 transition-colors"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline font-display">Admin</span>
                  </Link>
                )}
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <Link 
                href="/settings"
                className="p-2 text-ash hover:text-paper transition-colors rounded-full hover:bg-obsidian-raised"
              >
                <Settings className="w-5 h-5" />
              </Link>
              
              <div className="h-8 w-px bg-obsidian-raised"></div>
              
              <form action="/auth/signout" method="POST">
                <button 
                  type="submit"
                  className="flex items-center gap-2 text-sm font-medium text-ash hover:text-trixon-danger transition-colors font-display"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-8 flex flex-col">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
