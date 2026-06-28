import { updateSession } from "@/lib/supabase/middleware";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - /public/* routes (unauthenticated badge summary pages)
     * - /api/badge/* routes (unauthenticated SVG badge endpoint)
     * - Public assets (images, svgs, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|public/|api/badge/|api/public/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
