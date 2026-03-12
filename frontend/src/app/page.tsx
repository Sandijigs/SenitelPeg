"use client";

import { useState, useCallback } from "react";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Dashboard } from "@/components/Dashboard";
import { Footer } from "@/components/Footer";

export default function Page() {
  const [address, setAddress] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      alert("Please install MetaMask.");
      return;
    }
    try {
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      setAddress(addr);
    } catch {
      // ignored
    }
  }, []);

  return (
    <>
      <Navbar address={address} onConnect={handleConnect} />
      <Hero />
      <HowItWorks />
      <Dashboard />
      <Footer />
    </>
  );
}
