interface ConnectWalletProps {
  address: string | null;
  onConnect: () => void;
}

export function ConnectWallet({ address, onConnect }: ConnectWalletProps) {
  const displayAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <div className="max-w-[900px] mx-auto mb-6 flex justify-between items-center">
      <button
        onClick={onConnect}
        className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-opacity"
      >
        {address ? "Connected" : "Connect Wallet"}
      </button>
      {displayAddr && (
        <span className="font-mono text-sm text-gray-400">{displayAddr}</span>
      )}
    </div>
  );
}
