import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-paper-raised">
      {/* Left side - Content */}
      <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12 relative">
        <Link href="/" className="absolute top-8 left-8 sm:left-16 lg:left-24">
          <Image
            src="/dark-logo.png"
            alt="Trixon"
            width={120}
            height={32}
            className="h-8 w-auto"
          />
        </Link>
        <div className="w-full max-w-sm mx-auto">{children}</div>
      </div>

      {/* Right side - Visual */}
      <div className="hidden md:flex flex-col justify-center bg-obsidian p-12 relative overflow-hidden">
        {/* Background gradient/glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-obsidian/10 blur-3xl" />
        
        <div className="relative z-10 max-w-lg mx-auto text-center">
          <h2 className="text-3xl font-bold text-paper-raised mb-6">
            Understand your codebase in minutes, not months.
          </h2>
          <p className="text-[#a39e9f] text-lg leading-relaxed mb-12">
            Join founders who use Trixon to map architecture, find tech debt,
            and generate investor-ready documentation automatically.
          </p>

          {/* Testimonial or feature highlight */}
          <div className="bg-paper-raised/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm text-left">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-obsidian/20 flex items-center justify-center">
                <span className="text-obsidian font-semibold">T</span>
              </div>
              <div>
                <p className="text-sm font-medium text-paper-raised">Security Audit Complete</p>
                <p className="text-xs text-[#a39e9f]">Found 2 critical vulnerabilities</p>
              </div>
            </div>
            <div className="h-2 bg-paper-raised/5 rounded-full overflow-hidden">
              <div className="h-full bg-obsidian w-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
