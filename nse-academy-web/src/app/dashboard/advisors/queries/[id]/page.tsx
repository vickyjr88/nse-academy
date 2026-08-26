"use client";

import { useParams } from "next/navigation";
import QueryThread from "@/components/QueryThread";

export default function ClientQueryThreadPage() {
  const params = useParams<{ id: string }>();
  return <QueryThread queryId={params.id} role="client" backHref="/dashboard/advisors" />;
}
