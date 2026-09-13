import { Castle, Fireworks } from "@/src/kit/Castle";
import { Sky } from "@/src/kit/Sky";
import { LETTER } from "@/src/story";

type Props = {
  onStart: () => void;
  /** 开启动画进行中：按钮转文案，防止连点 */
  opening: boolean;
  /** 设备自检结果，给一句安心的提示 */
  ready: { location: boolean; camera: boolean; offline: boolean };
};

/** 信封页：动画片头那种「城堡在远处，一封信落到你手里」。 */
export function Cover({ onStart, opening, ready }: Props) {
  const notes = [
    ready.location ? "定位就绪" : "定位待授权",
    ready.camera ? "相机就绪" : "相机待授权",
    ready.offline ? "离线可用" : "正在缓存",
  ];
  return (
    <section className={`screen cover ${opening ? "is-opening" : ""}`} aria-label="邀请函">
      <Sky stars={64} dust={8} />
      <div className="cover-fireworks"><Fireworks /></div>
      <Castle className="cover-castle" />

      <div className="cover-letter">
        <div className="seal cover-seal" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M10 34h28l-3-16-8 7-7-11-7 11-8-7z" fill="currentColor" opacity=".92" />
            <path d="M10 34h28v4H10z" fill="currentColor" opacity=".92" />
          </svg>
        </div>
        <span className="eyebrow">{LETTER.eyebrow}</span>
        <h1>{LETTER.title}</h1>
        <p className="lead">{LETTER.opening}</p>
        <p className="body" dangerouslySetInnerHTML={{ __html: LETTER.body }} />

        <div className="cover-actions">
          <button className="btn" type="button" onClick={onStart} disabled={opening}>
            {opening ? "城堡的门正在开……" : LETTER.button}
          </button>
          <span className="cover-note">{notes.join(" · ")}</span>
        </div>
      </div>

      <footer className="cover-footer">{LETTER.footer}</footer>
    </section>
  );
}
