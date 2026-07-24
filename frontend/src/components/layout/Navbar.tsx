"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setIsLoggingOut(false);
    router.push("/");
  };

  return (
    <nav className="sticky top-0 z-50 bg-obsidian border-b border-white/5">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group flex-shrink-0 z-10">
            <Image
              src="/light-logo.png"
              alt="Trixon"
              width={140}
              height={38}
              className="h-10 w-auto object-contain transition-opacity duration-200 group-hover:opacity-90"
              priority
            />
          </Link>

          {/* Desktop Navigation (Centred relative to viewport) */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center gap-8 z-10">
            <Link
              href="/#features"
              className="text-sm font-medium text-[#a39e9f] hover:text-paper-raised transition-colors duration-200"
            >
              Features
            </Link>
            <Link
              href="/#how-it-works"
              className="text-sm font-medium text-[#a39e9f] hover:text-paper-raised transition-colors duration-200"
            >
              How it Works
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-[#a39e9f] hover:text-paper-raised transition-colors duration-200"
            >
              Pricing
            </Link>
          </div>

          {/* Desktop Auth Buttons (Aligned right) */}
          <div className="hidden md:flex items-center gap-4 z-10">
            {isLoggedIn === null ? (
              <div className="w-20 h-8 animate-pulse bg-paper-raised/5 rounded-lg" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-bold bg-white text-zinc-950 px-4 py-2 rounded-lg hover:bg-zinc-100 transition-all duration-200 shadow-sm"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="text-sm font-medium text-[#a39e9f] hover:text-paper-raised transition-colors duration-200 px-3 py-2"
                >
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="text-sm font-medium text-[#a39e9f] hover:text-red-400 transition-colors duration-200 px-3 py-2 disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : "Log out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-[#a39e9f] hover:text-paper-raised transition-colors duration-200 px-3 py-2"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="text-sm font-bold bg-[#039a85] text-white px-4 py-2 rounded-lg hover:bg-[#02816f] transition-all duration-200 shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
 
          {/* Mobile menu button */}
          <button
            type="button"
            className="md:hidden text-[#a39e9f] hover:text-paper-raised transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
 
      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 pt-2 space-y-2 border-t border-white/5">
          <Link
            href="/#features"
            className="block text-sm text-[#a39e9f] hover:text-paper-raised transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="block text-sm text-[#a39e9f] hover:text-paper-raised transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            How it Works
          </Link>
          <Link
            href="/pricing"
            className="block text-sm text-[#a39e9f] hover:text-paper-raised transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            Pricing
          </Link>
          <div className="pt-2 border-t border-white/10 space-y-2">
            {isLoggedIn === null ? (
              <div className="w-full h-10 animate-pulse bg-paper-raised/5 rounded-lg" />
            ) : isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="block text-sm font-medium bg-paper-raised text-zinc-900 text-center px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-all duration-200"
                >
                  Dashboard
                </Link>
                <Link
                  href="/settings"
                  className="block text-sm text-[#a39e9f] hover:text-paper-raised transition-colors py-2"
                >
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-sm text-[#a39e9f] hover:text-red-500 transition-colors py-2"
                >
                  {isLoggingOut ? "Logging out..." : "Log out"}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="block text-sm text-[#a39e9f] hover:text-paper-raised transition-colors py-2"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="block text-sm font-medium bg-[#039a85] text-paper-raised text-center px-5 py-2.5 rounded-lg hover:bg-[#02816f] transition-all duration-200"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
