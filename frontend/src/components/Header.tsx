import { HOOK_ADDRESS, CHAIN_ID } from "@/lib/constants";

export function Header() {
  const shortAddr = `${HOOK_ADDRESS.slice(0, 6)}...${HOOK_ADDRESS.slice(-4)}`;
  const explorerUrl = `https://unichain-sepolia.blockscout.com/address/${HOOK_ADDRESS}`;
  const networkName = CHAIN_ID === 1301 ? "Unichain Sepolia" : `Chain ${CHAIN_ID}`;

  return (
    <header className="text-center mb-8">
      <h1 className="text-3xl font-bold tracking-tight">
        <span role="img" aria-label="shield">🛡️</span>{" "}
        Sentinel<span className="text-blue-500">Peg</span>
      </h1>
      <p className="text-gray-400 mt-2">
        Real-time depeg defense for stablecoin liquidity pools
      </p>
      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-gray-900 border border-gray-800 rounded-full text-xs text-gray-400">
        <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {networkName}
        <span className="text-gray-600">|</span>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-400 hover:text-blue-300"
        >
          {shortAddr}
        </a>
      </div>
    </header>
  );
}
