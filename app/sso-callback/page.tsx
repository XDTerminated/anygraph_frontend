import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
