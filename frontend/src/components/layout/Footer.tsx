import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-obsidian border-t border-white/5 relative grain-overlay">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="md:col-span-1">
            <Link href="/" className="inline-block">
              <Image
                src="/light-logo.png"
                alt="Trixon"
                width={110}
                height={28}
                className="h-7 w-auto"
                style={{ width: "auto", height: "auto" }}
              />
            </Link>
            <p className="mt-4 text-sm text-ash leading-relaxed max-w-xs">
              AI-powered technical intelligence for non-technical founders.
              Understand what you built. Scale with confidence.
            </p>
          </div>

          {/* Product column */}
          <div>
            <h3 className="text-sm font-semibold text-paper-raised mb-4">Product</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/#features"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  How it Works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h3 className="text-sm font-semibold text-paper-raised mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h3 className="text-sm font-semibold text-paper-raised mb-4">Legal</h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="#"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="#"
                  className="text-sm text-ash hover:text-paper-raised transition-colors duration-200"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ash">
            &copy; 2026 Trixon. All rights reserved.
          </p>
          <p className="text-xs text-ash/60">
            Trixon · <a href="/engage" className="hover:text-paper-raised transition-colors">Book a call</a> · hello@trixon.cloud
          </p>
        </div>
      </div>
    </footer>
  );
}
