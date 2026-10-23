/** Campo de euros (número ≥ 0, 2 casas) com o sufixo «€». */
function EuroInput({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`flex items-center border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden ${className}`}>
      <input
        type="number"
        min={0}
        step={0.01}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="flex-1 px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 focus:outline-none w-0"
      />
      <span className="px-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 self-stretch flex items-center">€</span>
    </div>
  );
}

/** Dinheiro / MBway / Cartão lado a lado. */
export function PaymentInputs({ cash, mbway, card, setCash, setMbway, setCard }: {
  cash: string; mbway: string; card: string;
  setCash: (v: string) => void; setMbway: (v: string) => void; setCard: (v: string) => void;
}) {
  const fields: [string, string, (v: string) => void][] = [
    ["Dinheiro", cash, setCash],
    ["MBway", mbway, setMbway],
    ["Cartão", card, setCard],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map(([label, val, setter]) => (
        <div key={label}>
          <p className="text-xs text-zinc-500 mb-1">{label}</p>
          <EuroInput value={val} onChange={setter} />
        </div>
      ))}
    </div>
  );
}

/** Gorjeta (opcional) — soma ao dinheiro recebido ao guardar. */
export function TipField({ tip, setTip, labelClassName = "" }: { tip: string; setTip: (v: string) => void; labelClassName?: string }) {
  return (
    <div>
      <p className={`text-xs text-zinc-500 mb-1 ${labelClassName}`}>
        Gorjeta <span className="text-zinc-300 dark:text-zinc-600">(opcional)</span>
      </p>
      <EuroInput value={tip} onChange={setTip} className="w-28" />
    </div>
  );
}
