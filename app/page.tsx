"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function Home() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded || isSignedIn) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-3xl font-semibold text-white">
          Sign in to AnyGraph
        </h1>

        <GoogleSignInButton />
      </div>
    </div>
  );
}
