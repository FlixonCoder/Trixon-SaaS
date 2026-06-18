"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      setIsSuccess(true);
      setIsLoading(false);
    }
  };

  const handleGithubSignup = async () => {
    setIsGithubLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
      setIsGithubLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="text-center py-4">
        <div className="mb-8">
          <div className="mx-auto w-12 h-12 bg-[#27272a]/10 rounded-full flex items-center justify-center mb-6">
            <Mail className="w-6 h-6 text-obsidian" />
          </div>
          <h1 className="text-2xl font-bold text-obsidian mb-3">Check your email</h1>
          <p className="text-ash text-sm leading-relaxed">
            We sent a verification link to <br />
            <span className="font-medium text-obsidian">{email}</span>
            <br /><br />
            Please verify your email to continue.
          </p>
        </div>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center gap-2 bg-obsidian text-paper-raised px-4 py-2.5 rounded-lg font-medium hover:bg-[#27272a] transition-all hover:shadow-lg hover:shadow-obsidian/20"
        >
          Return to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-obsidian mb-2">Create your account</h1>
        <p className="text-ash text-sm">
          Join founders shipping fast and scaling smart.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 text-sm text-red-500 bg-red-500/10 rounded-lg border border-[#E53E3E]/20">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <button
          type="button"
          onClick={handleGithubSignup}
          disabled={isGithubLoading || isLoading}
          className="w-full flex items-center justify-center gap-3 bg-obsidian text-paper-raised px-4 py-2.5 rounded-lg font-medium hover:bg-black transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isGithubLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Connecting to GitHub...
            </>
          ) : (
            <>
              <GitBranch className="w-5 h-5" />
              Sign up with GitHub
            </>
          )}
        </button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-paper-sunken"></div>
          <span className="flex-shrink-0 mx-4 text-ash text-xs font-medium uppercase">
            Or continue with email
          </span>
          <div className="flex-grow border-t border-paper-sunken"></div>
        </div>

        <form onSubmit={handleEmailSignup} className="space-y-4">
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
            <label
              htmlFor="password"
              className="block text-sm font-medium text-obsidian"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2.5 bg-paper-raised border border-paper-sunken rounded-lg focus:outline-none focus:ring-2 focus:ring-[#18181b]/20 focus:border-obsidian transition-all text-sm"
              placeholder="•••••••• (min 8 characters)"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || isGithubLoading}
            className="w-full flex items-center justify-center gap-2 bg-obsidian text-paper-raised px-4 py-2.5 rounded-lg font-medium hover:bg-[#27272a] transition-all hover:shadow-lg hover:shadow-obsidian/20 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </button>
        </form>
      </div>

      <p className="mt-8 text-center text-sm text-ash">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-obsidian hover:text-[#27272a]"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
