import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trixon — How We Engage",
  description:
    "Trixon's Build-Operate-Transfer model — designed for founders who have something built but can't safely scale it.",
};

export default function EngageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
