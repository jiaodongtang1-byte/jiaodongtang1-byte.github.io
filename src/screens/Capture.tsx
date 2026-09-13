import { useRef, useState } from "react";
import { RELICS } from "@/src/kit/Relic";
import { scorePhoto, resizePhotoFile } from "@/src/lib/photoMatch";
import type { MatchResult } from "@/src/types";
import type { Station } from "@/src/story";

type Props = {
  station: Station;
  /** 现场拍的参考照；没有就只做记录，不卡分 */
  referenceSrc?: string;
  attempt: number;
  onCancel: () => void;
  onResult: (result: MatchResult, dataUrl: string) => void;
};

const PASS_SCORE = 55;

export function Capture({ station, referenceSrc, attempt, onCancel, onResult }: Props) {
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setNote(null);
    setBusy(true);
    try {
      setShot(await resizePhotoFile(file));
    } catch {
      setNote("这张照片读不出来，换一张试试。");
    } finally {
      setBusy(false);
    }
  }

  async function compare() {
    if (!shot) return;
    setBusy(true);
    setNote(null);
    try {
      // 没有现场参考照时，这一关只做记录——拿插画去比对真人是没有意义的。
      const result: MatchResult = referenceSrc
        ? await scorePhoto(referenceSrc, shot, "pose-scene", PASS_SCORE)
        : { score: 100, sceneScore: 100, poseScore: null, subjectScore: 100, message: "已记录" };
      if (!referenceSrc) {
        onResult(result, shot);
        return;
      }
      if (result.score >= PASS_SCORE) {
        onResult(result, shot);
      } else {
        setNote(`还差一点（${result.score} 分）。${result.message}`);
        setBusy(false);
      }
    } catch {
      setNote("比对时出了点问题，再试一次。");
      setBusy(false);
    }
  }

  return (
    <section className="capture" aria-label="照片复刻">
      <div className="capture-top">
        <button className="btn is-ghost" type="button" onClick={onCancel}>返回</button>
        <div className="t">
          <span className="eyebrow">PHOTO RE-CREATION</span>
          <b>按提示拍一张，收下这件信物</b>
        </div>
        <span className="chip">第 {attempt + 1} 次</span>
      </div>

      <div className="capture-panes">
        <section className="capture-pane">
          <header>
            <span className="n">01</span>
            <div><b>姿势参考</b><small>{referenceSrc ? "现场实拍" : "照这个意思拍"}</small></div>
          </header>
          <div className="capture-stage">
            {referenceSrc
              ? <img src={referenceSrc} alt="参考照片" />
              : (
                <div style={{ display: "grid", justifyItems: "center", gap: 10, padding: "18px 14px", textAlign: "center" }}>
                  <div style={{ width: "min(190px, 46%)" }}>{RELICS[station.relic]}</div>
                  <p style={{ color: "var(--mist)", fontSize: 13, maxWidth: "24em" }}>{station.pose}</p>
                </div>
              )}
          </div>
        </section>

        <div className="capture-seam" aria-hidden="true">
          <div className="seal">
            <svg viewBox="0 0 48 48"><path d="M10 34h28l-3-16-8 7-7-11-7 11-8-7z" fill="currentColor" /></svg>
          </div>
        </div>

        <section className="capture-pane">
          <header>
            <span className="n">02</span>
            <div><b>你的复刻</b><small>从相册里选一张</small></div>
          </header>
          <div className="capture-stage">
            {shot
              ? <img src={shot} alt="你的照片" />
              : (
                <label className="capture-drop">
                  <span className="plus">+</span>
                  <b>{busy ? "正在读取…" : "选择照片"}</b>
                  <small>照片只留在这台设备上，不会上传</small>
                  <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
                </label>
              )}
          </div>
        </section>
      </div>

      <div className="capture-bar">
        <span className="need">{note ?? station.pose}</span>
        <button className="btn" type="button" disabled={!shot || busy} onClick={() => void compare()}>
          {busy ? "正在看……" : shot ? "收下这件信物" : "先选一张照片"}
        </button>
      </div>

      {!referenceSrc && (
        <p className="capture-note">这一站还没有现场参考照，所以只记录、不打分。</p>
      )}
    </section>
  );
}
