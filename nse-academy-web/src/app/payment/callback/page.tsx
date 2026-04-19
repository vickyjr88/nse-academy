"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference");

  useEffect(() => {
    // Paystack returns a 'reference' query parameter
    // In a production app, you might want to call your API to verify it immediately
    // or just let the landing page's background processes handle it (since webhook does the heavy lifting)
    
    const timer = setTimeout(() => {
      router.push("/dashboard/billing");
    }, 3000);

    return () => clearTimeout(timer);
  }, [router, reference]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-6xl mb-6 animate-bounce">🎉</div>
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Payment Successful!</h1>
      <p className="text-lg text-gray-600 max-w-md mx-auto">
        Thank you for your payment. We are updating your subscription status now.
      </p>
      <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        Redirecting you to the dashboard...
      </div>
      {reference && (
        <p className="mt-8 text-xs text-gray-400 font-mono">
          Ref: {reference}
        </p>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
