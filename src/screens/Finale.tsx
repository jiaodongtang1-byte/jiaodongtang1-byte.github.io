import { Castle, Fireworks } from "@/src/kit/Castle";
import { Sky } from "@/src/kit/Sky";
import { FINALE, STATIONS } from "@/src/story";
import type { CapturedPhoto } from "@/src/types";

type Props = {
  photos: CapturedPhoto[];
  /** 彩排模式才给「重新走一遍」 */
  rehearsal: boolean;
  onReset: () => void;
  onShare: (photo: CapturedPhoto) => void;
};

/** 终章：城堡全亮，烟花。 */
export function Finale({ photos, rehearsal, onReset, onShare }: Props) {
  return (
    <section className="screen finale" aria-label="终章">
      <Sky stars={72} dust={12} seed={99} />
      <Fireworks
        spots={[
          { x: 14, y: 20, color: "var(--rose)", delay: 0, rays: 14 },
          { x: 86, y: 26, color: "var(--gold)", delay: 0.9, rays: 14 },
          { x: 50, y: 10, color: "var(--mint)", delay: 1.8, rays: 16 },
          { x: 28, y: 34, color: "var(--royal-lift)", delay: 2.6 },
          { x: 72, y: 16, color: "var(--rose)", delay: 3.4 },
          { x: 60, y: 40, color: "var(--gold)", delay: 4.2 },
        ]}
        className="finale-fireworks"
      />
      <Castle className="finale-castle" />

      <div className="finale-inner">
        <span className="eyebrow">{FINALE.eyebrow}</span>
        <h1>{FINALE.title}</h1>
        <blockquote dangerouslySetInnerHTML={{ __html: FINALE.body }} />

        <div className="gallery">
          {photos.length
            ? photos.map((photo) => (
              <button key={photo.id} type="button" onClick={() => onShare(photo)}>
                <img src={photo.dataUrl} alt="探索复刻照片" />
                <span>{STATIONS.find((s) => s.id === photo.checkpointId)?.relicName ?? "信物"}</span>
              </button>
            ))
            : <p style={{ color: "var(--veil)", fontSize: 12 }}>三件信物的照片会出现在这里。</p>}
        </div>

        {rehearsal && <button className="btn is-quiet" type="button" onClick={onReset}>重新走一遍</button>}
        <span className="foot">{FINALE.footer}</span>
      </div>
    </section>
  );
}
