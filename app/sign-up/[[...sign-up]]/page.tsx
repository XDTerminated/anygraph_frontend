import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      <SignUp forceRedirectUrl="/dashboard" />
    </div>
  );
}
