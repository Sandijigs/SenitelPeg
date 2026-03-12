export function Header() {
  return (
    <header className="text-center mb-8">
      <h1 className="text-3xl font-bold tracking-tight">
        <span role="img" aria-label="shield">🛡️</span>{" "}
        Sentinel<span className="text-blue-500">Peg</span>
      </h1>
      <p className="text-gray-400 mt-2">
        Real-time depeg defense for stablecoin liquidity pools
      </p>
    </header>
  );
}
