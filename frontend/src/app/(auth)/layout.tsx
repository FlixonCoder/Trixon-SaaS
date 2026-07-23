import Link from "next/link";
import Image from "next/image";
import { Check, Shield, TrendingUp, Zap } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 bg-paper-raised">
      {/* Left side - Form */}
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

      {/* Right side - Visual panel */}
      <div className="hidden md:flex flex-col justify-center bg-obsidian px-12 py-16 relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#039a85]/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[#039a85]/3 blur-3xl pointer-events-none" />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#039a85 1px, transparent 1px), linear-gradient(90deg, #039a85 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        <div className="relative z-10 max-w-sm">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-[#039a85]/10 border border-[#039a85]/20 rounded-full px-3 py-1 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-[#039a85] animate-pulse" />
            <span className="text-xs font-medium text-[#039a85]">
              Free during beta
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
            Understand your codebase in minutes,{" "}
            <span className="text-[#039a85]">not months.</span>
          </h2>
          <p className="text-[#a39e9f] text-base leading-relaxed mb-10">
            Connect your repo once and Trixon does the rest — security scans,
            tech debt analysis, architecture maps, and investor-ready docs.
            All in plain English.
          </p>

          {/* Feature checklist */}
          <ul className="space-y-3 mb-10">
            {[
              { icon: Zap, text: "First report ready in under 5 minutes" },
              { icon: Shield, text: "Security scan catches critical vulnerabilities" },
              { icon: TrendingUp, text: "Health score tracked across every commit" },
              { icon: Check, text: "AI prompts to fix every finding instantly" },
            ].map((item) => (
              <li key={item.text} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#039a85]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.icon className="w-3 h-3 text-[#039a85]" />
                </div>
                <span className="text-sm text-[#a39e9f]">{item.text}</span>
              </li>
            ))}
          </ul>

          {/* Live metrics card */}
          <div className="bg-[#272424] border border-white/8 rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#5a5458] mb-4">
              What a typical first analysis finds
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "74", label: "Avg health score", color: "text-[#039a85]" },
                { value: "3–7", label: "Security issues found", color: "text-amber-400" },
                { value: "12+", label: "Action items generated", color: "text-white" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className={`text-2xl font-bold font-mono ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-[#5a5458] leading-tight mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Mini health bar */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex justify-between text-[10px] text-[#5a5458] mb-1.5">
                <span>Code health trend after 5 snapshots</span>
                <span className="text-[#039a85] font-semibold">+22 pts</span>
              </div>
              <div className="h-1.5 bg-[#1e1b1b] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#039a85]/60 to-[#039a85] rounded-full animate-pulse"
                  style={{ width: "74%" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
