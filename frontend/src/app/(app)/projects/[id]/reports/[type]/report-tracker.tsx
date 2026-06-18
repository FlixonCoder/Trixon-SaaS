"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";

export function ReportTracker({ 
  reportType, 
  projectId, 
  token 
}: { 
  reportType: string;
  projectId: string;
  token: string;
}) {
  useEffect(() => {
    // Fire tracking event
    api.trackEvent(token, "report_viewed", projectId, { report_type: reportType });
  }, [reportType, projectId, token]);

  return null;
}
