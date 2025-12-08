import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "react-hot-toast";
import "@uploadthing/react/styles.css";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AnyGraph - Easy Data Analysis",
  description: "Upload datasets and perform data analysis without coding",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#ffffff",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#1a1a1a",
          colorInputText: "#ffffff",
          colorText: "#ffffff",
          colorTextSecondary: "#888888",
        },
        elements: {
          formButtonPrimary: "bg-white text-black hover:bg-gray-100",
          card: "bg-[#0f0f0f] border border-[#222]",
          headerTitle: "text-white",
          headerSubtitle: "text-[#888]",
          socialButtonsBlockButton: "bg-[#1a1a1a] border-[#333] text-white hover:bg-[#222]",
          formFieldLabel: "text-[#888]",
          formFieldInput: "bg-[#1a1a1a] border-[#333] text-white",
          footerActionLink: "text-white hover:text-gray-300",
        },
      }}
    >
      <html lang="en">
        <body className={inter.className}>
          {children}
          <Toaster position="top-right" />
        </body>
      </html>
    </ClerkProvider>
  );
}
