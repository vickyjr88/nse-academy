"use client";

import { useParams } from "next/navigation";
import QueryThread from "@/components/QueryThread";

export default function AdvisorQueryThreadPage() {
  const params = useParams<{ id: string }>();
  return <QueryThread queryId={params.id} role="advisor" backHref="/dashboard/advisor" />;
}
