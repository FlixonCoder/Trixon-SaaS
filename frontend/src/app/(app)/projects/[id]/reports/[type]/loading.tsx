import { ReportSkeleton } from "@/components/skeleton";

export default function ReportLoading() {
  return (
    <div className="min-h-screen bg-paper-sunken">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <ReportSkeleton />
      </main>
    </div>
  );
}
