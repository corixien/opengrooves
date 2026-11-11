import { MAX_BPM, MIN_BPM } from "../../../shared/groove";
import type { PlayerState } from "../audio/usePlayer";
import { useI18n } from "../i18n";
import { Select } from "./Select";

interface Props {
  player: PlayerState;
  bpm: number;
  onBpm: (bpm: number) => void;
}

export function PlayerBar({ player, bpm, onBpm }: Props) {
  const { t } = useI18n();
  const { settings: s, update, playing, status } = player;
  const clamp = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v) || MIN_BPM));
  return (
    <div className="player">
      <button
        className="btn primary play"
        onClick={playing ? player.stop : player.start}
        disabled={status !== "ready"}
        aria-pressed={playing}
      >
        {status === "loading" ? t("loadingSounds") : status === "error" ? t("soundsError") : playing ? `■ ${t("stop")}` : `▶ ${t("play")}`}
      </button>

      <label className="field tempo">
        <span>{t("tempo")}</span>
        <div className="tempo-row">
          <button className="btn small" onClick={() => onBpm(clamp(bpm - 1))} aria-label="-1">−</button>
          <input type="number" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => onBpm(clamp(Number(e.target.value)))} />
          <button className="btn small" onClick={() => onBpm(clamp(bpm + 1))} aria-label="+1">+</button>
        </div>
        <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => onBpm(Number(e.target.value))} />
      </label>

      <div className="mixer">
        <div className="mix">
          <button className={`toggle${s.grooveOn ? " on" : ""}`} aria-pressed={s.grooveOn} onClick={() => update({ grooveOn: !s.grooveOn })}>
            {t("groove")}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={s.grooveVol} onChange={(e) => update({ grooveVol: Number(e.target.value) })} aria-label={`${t("groove")} ${t("volume")}`} />
        </div>
        <div className="mix">
          <button className={`toggle${s.metroOn ? " on" : ""}`} aria-pressed={s.metroOn} onClick={() => update({ metroOn: !s.metroOn })}>
            {t("metronome")}
          </button>
          <input type="range" min={0} max={1} step={0.01} value={s.metroVol} onChange={(e) => update({ metroVol: Number(e.target.value) })} aria-label={`${t("metronome")} ${t("volume")}`} />
        </div>
      </div>

      <div className="opts">
        <label className="check">
          <input type="checkbox" checked={s.countIn} onChange={(e) => update({ countIn: e.target.checked })} />
          {t("countIn")}
        </label>
        <label className="check">
          <input type="checkbox" checked={s.loop} onChange={(e) => update({ loop: e.target.checked })} />
          {t("loop")}
        </label>
        <div className="field inline">
          <span>{t("clickUnit")}</span>
          <Select
            className="unit"
            label={t("clickUnit")}
            value={s.metroUnit}
            onChange={(metroUnit) => update({ metroUnit })}
            options={[
              { value: 1, label: t("unitQuarter") },
              { value: 2, label: t("unitEighth") },
              { value: 4, label: t("unitSixteenth") },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
