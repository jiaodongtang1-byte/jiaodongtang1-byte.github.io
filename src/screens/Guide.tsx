import { useState } from "react";
import { STATIONS, GUIDE_PIN } from "@/src/story";
import type { PositionSample } from "@/src/types";

type Props = {
  index: number;
  position: PositionSample | null;
  distanceM: number;
  onForceArrive: () => void;
  onForceSolved: () => void;
  onSkip: () => void;
  onClose: () => void;
  onReset: (keepPhotos: boolean) => void;
};

/** 引路人控制台：走投无路时的后门。 */
export function Guide({ index, position, distanceM, onForceArrive, onForceSolved, onSkip, onClose, onReset }: Props) {
  const station = STATIONS[index];
  return (
    <div className="guide">
      <section className="guide-card">
        <header>
          <div>
            <span className="eyebrow">THE GUIDE</span>
            <h2>引路人控制台</h2>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>

        <div className="guide-grid">
          <button type="button" onClick={onForceArrive}>强制抵达</button>
          <button type="button" onClick={onForceSolved}>强制收下</button>
          <button type="button" onClick={onSkip}>跳到下一站</button>
          <button type="button" onClick={onForceArrive}>当前位置重取</button>
        </div>

        <div className="guide-read">
          <span>当前：第 {index + 1} 站 · {station.place}</span>
          <code>
            {position
              ? `定位 ${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)} · ±${Math.round(position.accuracy)}m`
              : "尚未取得定位"}
          </code>
          <code>目标 {station.location.latitude.toFixed(6)}, {station.location.longitude.toFixed(6)}</code>
          <code>直线距离 {Number.isFinite(distanceM) ? `${Math.round(distanceM)} 米` : "等待定位"}</code>
        </div>

        <footer>
          <button type="button" onClick={() => onReset(true)}>保留照片并重置</button>
          <button type="button" onClick={() => onReset(false)}>清空全部数据</button>
        </footer>
      </section>
    </div>
  );
}

/** 进入控制台前的口令。 */
export function GuideGate({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  return (
    <div className="guide">
      <form
        className="pin-card"
        onSubmit={(event) => {
          event.preventDefault();
          if (pin === GUIDE_PIN) onSubmit();
          else setError(true);
        }}
      >
        <span className="eyebrow">GUIDE ONLY</span>
        <h2 style={{ marginTop: 8 }}>输入引路人口令</h2>
        <input
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(event) => { setPin(event.target.value.replace(/\D/g, "")); setError(false); }}
          aria-label="引路人口令"
        />
        {error && <p className="err">星光没有认出这个口令。</p>}
        <div className="row">
          <button className="btn is-ghost" type="button" onClick={onCancel}>取消</button>
          <button className="btn" type="submit">进入</button>
        </div>
      </form>
    </div>
  );
}
