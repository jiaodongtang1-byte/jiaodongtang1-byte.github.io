import { RELICS } from "@/src/kit/Relic";
import type { Station } from "@/src/story";

type Props = {
  station: Station;
  score: number;
  /** 最后一站收完就直接进终章 */
  last: boolean;
  onNext: () => void;
};

/** 解锁：信物到手的那一屏。 */
export function Reveal({ station, score, last, onNext }: Props) {
  return (
    <div className="veil-screen">
      <section className="reveal">
        <div className="seal reveal-seal" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M10 34h28l-3-16-8 7-7-11-7 11-8-7z" fill="currentColor" />
            <path d="M10 34h28v4H10z" fill="currentColor" />
          </svg>
        </div>
        <span className="eyebrow">HEIRLOOM FOUND</span>
        <div className="art">{RELICS[station.relic]}</div>
        <h2>{station.relicName}<small>{station.place}</small></h2>
        <p className="line">{station.unlockLine}</p>
        {score < 100 && <p className="score">照片匹配度 {score}%</p>}
        <button className="btn" type="button" onClick={onNext}>
          {last ? "回到城堡" : "收好，继续走"}
        </button>
      </section>
    </div>
  );
}
