import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata = {
  title: "Terms of Service — Trixon",
  description: "Read Trixon's terms of service, usage guidelines, and technical liability details.",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-xs text-[#837e80] mb-8 font-medium">
            Last Updated: July 24, 2026
          </p>

          <p className="text-sm text-[#837e80] leading-relaxed mb-8">
            Please read these Terms of Service ("Terms", "Terms of Service") carefully before using the Trixon codebase analysis platform ("Service") operated by Trixon ("us", "we", or "our").
            By accessing or using the Service, you agree to be bound by these Terms.
          </p>

          <hr className="border-[#F6F4F4] my-8" />

          <div className="space-y-8">
            {/* Section 1 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                1. Account Registration and Access
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                To use the Service, you must register for an account by providing an email and setting up secure credentials. 
                You agree to keep your credentials confidential and notify us immediately of any unauthorized access. 
                During onboarding, we collect specific details (name, company name, role, goal, and referral source) to tailor the Service to your product goals.
              </p>
            </div>

            {/* Section 2 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                2. Codebase Integration and Permissions
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                Trixon requires integration with your Version Control System (VCS), such as GitHub or GitLab, via OAuth tokens. 
                Trixon requests **read-only access** to analyze your code and repository structure. We do not write to, modify, or delete your source repositories. 
                You represent that you have the legal right and authorization to grant Trixon read access to all connected codebases.
              </p>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                3. Intellectual Property
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                You retain full, exclusive ownership of all source code, comments, files, and intellectual property analyzed by Trixon. 
                Trixon does not claim any ownership rights over your code, nor does it share your code or metadata with third parties for training public LLM models.
              </p>
            </div>

            {/* Section 4 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                4. Disclaimer of Technical Liability
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                Trixon provides AI-generated analysis, technical health scores, and recommended fix prompts. 
                These findings are intended for informational and technical guidance purposes only. 
                We do not guarantee that applying AI-recommended fixes or prompts will be error-free or fully secure. 
                You acknowledge that any changes you make to your codebase based on Trixon reports are done at your own risk.
              </p>
            </div>

            {/* Section 5 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                5. Subscription Gating and Termination
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                Unless in Beta Mode, access to advanced reports, history charts, and codebase chat may be gated behind a subscription. 
                We reserve the right to suspend or terminate accounts that violate these terms or abuse API thresholds (e.g. rate limit scraping).
              </p>
            </div>

            {/* Section 6 */}
            <div>
              <h2 className="text-lg font-bold text-[#1e1b1b] mb-3">
                6. Changes to Terms
              </h2>
              <p className="text-sm text-[#837e80] leading-relaxed">
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide notice before the new terms take effect.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
