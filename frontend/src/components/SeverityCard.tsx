"use client";

import { useEffect, useRef } from "react";
import { SEV_CONFIG, type Severity } from "@/lib/constants";

interface SeverityCardProps {
  severity: Severity;
  driftBps: number;
  isStale: boolean;
}

export function SeverityCard({ severity, driftBps, isStale }: SeverityCardProps) {
  const config = SEV_CONFIG[severity];
  const driftPct = (driftBps / 100).toFixed(2);
  const cardRef = useRef<HTMLDivElement>(null);
  const prevSev = useRef(severity);

  useEffect(() => {
    if (severity !== prevSev.current && cardRef.current) {
      cardRef.current.classList.remove("animate-pulse-border");
      void cardRef.current.offsetWidth;
      cardRef.current.classList.add("animate-pulse-border");
      prevSev.current = severity;
    }
  }, [severity]);

  return (
    <div
      ref={cardRef}
      className="bg-gray-900 border border-gray-800 rounded-xl p-6 transition-all duration-500"
    >
      <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-4">
        Current Severity
      </h2>
      <span
        className={`inline-block px-4 py-1.5 rounded-full font-semibold text-xl transition-colors duration-500 ${config.bg} ${config.color}`}
      >
        {config.label}
      </span>
      <p className="mt-3 text-gray-400 text-sm">
        Peg drift: <strong className="text-gray-200">{driftPct}%</strong>
      </p>
      {isStale && (
        <p className="mt-2 text-yellow-400 text-xs font-medium animate-fade-in">
          Data is STALE — conservative fees active
        </p>
      )}
    </div>
  );
}
