import { useI18n, type Key } from "../i18n";

interface Props<T extends string> {
  options: readonly T[];
  value: T[];
  onChange: (v: T[]) => void;
  max?: number;
}

export function Chips<T extends string>({ options, value, onChange, max }: Props<T>) {
  const { t } = useI18n();
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            className={`chip${on ? " on" : ""}`}
            aria-pressed={on}
            disabled={!on && max !== undefined && value.length >= max}
            onClick={() => onChange(on ? value.filter((v) => v !== o) : [...value, o])}
          >
            {t(o as unknown as Key)}
          </button>
        );
      })}
    </div>
  );
}
