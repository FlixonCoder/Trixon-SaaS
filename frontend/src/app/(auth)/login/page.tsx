"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-obsidian mb-2">Welcome back</h1>
        <p className="text-ash text-sm">
          Log in to access your codebase reports and insights.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-[#E53E3E]/20">
          {error}
        </div>
      )}

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-obsidian"
          >
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-10 pr-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-obsidian"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-obsidian hover:text-[#27272a]"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-obsidian text-paper-raised px-4 py-2.5 rounded-lg font-medium hover:bg-[#27272a] transition-all hover:shadow-lg hover:shadow-obsidian/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-ash">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-obsidian hover:text-[#27272a]"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
