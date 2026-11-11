interface Props {
  options: readonly { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}

export function Chips({ options, value, onChange, max }: Props) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            className={`chip${on ? " on" : ""}`}
            aria-pressed={on}
            disabled={!on && max !== undefined && value.length >= max}
            onClick={() => onChange(on ? value.filter((v) => v !== o.id) : [...value, o.id])}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
