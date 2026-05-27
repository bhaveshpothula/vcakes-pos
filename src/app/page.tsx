"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      // Immediate client-side redirection to /dashboard
      const timer = setTimeout(() => {
        router.replace("/dashboard");
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [mounted, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bakery-dark">
      <div className="flex flex-col items-center gap-4">
        {/* Loading Spinner */}
        <div className="w-10 h-10 border-4 border-bakery-orange border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-bakery-muted">
          Loading Vcakes POS...
        </p>
      </div>
    </div>
  );
}
