"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyPaymentPage() {
  const router = useRouter();

  useEffect(() => {
    // In a real app, you'd verify the reference on the backend here.
    // For now, we'll just wait 2 seconds and redirect to billing.
    const timer = setTimeout(() => {
      router.push("/dashboard/billing");
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="text-6xl mb-6 animate-bounce">🎉</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
      <p className="text-gray-500">We are updating your subscription. One moment...</p>
    </div>
  );
}
