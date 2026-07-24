import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ShieldCheck, Lock, Eye, RefreshCw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Privacy Policy — Trixon",
  description: "Understand how Trixon securely handles your codebase metadata, VCS integration tokens, and personal details.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F6F4F4] flex flex-col">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 flex-1">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#837e80] hover:text-[#1e1b1b] transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="bg-white rounded-2xl border border-[#e0dada] p-8 sm:p-12 shadow-sm">
          <h1 className="text-3xl font-bold text-[#1e1b1b] tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-xs text-[#837e80] mb-8 font-medium">
            Last Updated: July 24, 2026
          </p>

          <p className="text-sm text-[#837e80] leading-relaxed mb-8">
            Trixon (the "Service", "we", "our") is designed to give non-technical founders codebase intelligence. 
            Because your code represents your core IP, we prioritize security and transparency in how we collect, store, and process your data.
          </p>

          <hr className="border-[#F6F4F4] my-8" />

          <div className="space-y-8">
            {/* Section 1 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                1. Information We Collect
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed mb-3">
                To personalise your experience, scan your repository, and deliver notifications, we collect the following information:
              </p>
              <ul className="list-disc pl-5 text-sm text-[#837e80] space-y-2">
                <li>
                  <strong>Personal Account Details:</strong> Your name (what you want us to call you), email address, company name, your role in the company, platform use case (e.g. investor due diligence, prep for hiring), and referral source.
                </li>
                <li>
                  <strong>VCS Integration Tokens:</strong> Encrypted access tokens from GitHub or GitLab. We only request read permissions and never write to your codebase.
                </li>
                <li>
                  <strong>Codebase Metadata:</strong> Structural statistics, dependency lists, file hierarchies, and language distributions extracted from your repositories.
                </li>
              </ul>
            </div>

            {/* Section 2 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                2. How We Secure Your Data
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                <div className="bg-[#F6F4F4] p-4 rounded-xl border border-[#e0dada]">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-[#039a85]" />
                    <span className="font-semibold text-xs text-[#1e1b1b]">Token Encryption</span>
                  </div>
                  <p className="text-xs text-[#837e80] leading-relaxed">
                    All Version Control (VCS) access tokens are encrypted at the application layer using AES-256 before storing them in our database.
                  </p>
                </div>
                <div className="bg-[#F6F4F4] p-4 rounded-xl border border-[#e0dada]">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-[#039a85]" />
                    <span className="font-semibold text-xs text-[#1e1b1b]">Code Privacy</span>
                  </div>
                  <p className="text-xs text-[#837e80] leading-relaxed">
                    Your code files are analyzed temporarily in memory within isolated pipeline containers. We do not persist copies of your codebase or keep repository files on disk.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                3. Use of AI Engines
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                Trixon processes metadata extraction layers using secure AI providers (e.g. Google Gemini, Groq). 
                We do not use your source code or metadata to train public LLM models, ensuring that your IP remains strictly yours.
              </p>
            </div>

            {/* Section 4 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                4. Data Retention and Deletion
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                You can disconnect your VCS connection or request profile deletion at any time in settings. 
                Upon deletion, all associated project logs, stored tokens, and snapshot records are immediately scrubbed from our systems.
              </p>
            </div>

            {/* Section 5 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                5. Contact Us
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                If you have questions about our data practices or want to request manual scrubbing of your records, reach out at{" "}
                <a href="mailto:hello@trixon.cloud" className="text-[#039a85] font-semibold underline">
                  hello@trixon.cloud
                </a>.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
