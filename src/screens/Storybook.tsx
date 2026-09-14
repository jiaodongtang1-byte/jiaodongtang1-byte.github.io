import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Castle, Fireworks } from "@/src/kit/Castle";
import { RELICS } from "@/src/kit/Relic";
import { Sky } from "@/src/kit/Sky";

/** 每页停留；配乐约 62 秒，六页铺满 */
const PAGE_MS = 9_600;
const SCORE_SRC = "/assets/audio/intro-film-score.mp3";

type Page = {
  id: string;
  eyebrow: string;
  title: string;
  line: string;
  art: ReactNode;
  tight?: boolean;
};

const PLATE = (src: string) => (
  <div className="plate">
    <img src={src} alt="" />
  </div>
);

const PAGES: Page[] = [
  {
    id: "letter",
    eyebrow: "A LETTER ARRIVED",
    title: "这封信走了二十七年",
    line: "有一封信，在路上走了整整二十七年，今天才送到你手上。",
    art: (
      <div style={{ position: "relative", height: "min(38vh, 300px)" }}>
        <Sky stars={40} dust={6} seed={7} />
        <Castle className="castle" />
      </div>
    ),
  },
  {
    id: "waiting",
    eyebrow: "THE CASTLE WAS WAITING",
    title: "有一座城堡，灯一直亮着",
    line: "它不在很远的地方。它只是等你想起自己是谁。",
    tight: true,
    art: PLATE("/assets/art/princess-terrace.webp"),
  },
  {
    id: "relics",
    eyebrow: "THREE HEIRLOOMS",
    title: "三件信物，散在你住的城市里",
    line: "玻璃鞋、魔镜、王冠——每找回一件，城堡就亮一分。",
    art: (
      <div style={{ display: "flex", gap: "clamp(8px, 3vw, 34px)", alignItems: "center", justifyContent: "center" }}>
        {(["slipper", "mirror", "crown"] as const).map((kind) => (
          <div key={kind} style={{ flex: "1 1 0", minWidth: 0 }}>{RELICS[kind]}</div>
        ))}
      </div>
    ),
  },
  {
    id: "first",
    eyebrow: "THE GLASS SLIPPER",
    title: "第一件：玻璃鞋",
    line: "从最热闹的地方开始找。",
    tight: true,
    art: RELICS.slipper,
  },
  {
    id: "home",
    eyebrow: "OCT 9 · 2026",
    title: "十月九日，我们接你回家",
    line: "城堡的灯为你亮起来的时候，所有的星星都会排好队。",
    tight: true,
    art: PLATE("/assets/art/princess-home.webp"),
  },
];

/** 开场绘本。没有视频文件：六页 DOM，文案在这一页里随时可改。 */
export function Storybook({ onDone }: { onDone: () => void }) {
  const [page, setPage] = useState(0);
  const [started, setStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const timer = useRef<number | null>(null);
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    audioRef.current?.pause();
    onDone();
  }, [onDone]);

  useEffect(() => {
    if (!started) return;
    timer.current = window.setTimeout(() => {
      setPage((current) => {
        if (current + 1 < PAGES.length) return current + 1;
        finish();
        return current;
      });
    }, PAGE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [started, page, finish]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  function play() {
    setStarted(true);
    setPage(0);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = 1;
      void audio.play().catch(() => { /* 不给自动出声就静音播，画面照走 */ });
    }
  }

  return (
    <section className="screen" aria-label="开场绘本">
      <Sky stars={62} dust={9} seed={31} />
      <Fireworks className="cover-fireworks" />

      <div className="book">
        {PAGES.map((item, index) => (
          <div
            key={item.id}
            className={`book-page ${index === page && started ? "is-now" : ""} ${index < page ? "is-past" : ""}`}
            aria-hidden={index !== page}
          >
            <div className={`book-art ${item.tight ? "is-tight" : ""}`}>{item.art}</div>
            <div className="book-copy">
              <span className="eyebrow">{item.eyebrow}</span>
              <h2>{item.title}</h2>
              <p>{item.line}</p>
            </div>
          </div>
        ))}
        <div className="book-pager" aria-hidden="true">
          {PAGES.map((item, index) => <i key={item.id} className={started && index <= page ? "is-on" : ""} />)}
        </div>
      </div>

      <audio ref={audioRef} src={SCORE_SRC} preload="auto" onEnded={finish} />

      {!started && (
        <div className="screen screen-center" style={{ position: "absolute", inset: 0, zIndex: 5 }}>
          <span className="eyebrow">A ROYAL LETTER · FOR THE PRINCESS</span>
          <h2 style={{ fontSize: "clamp(24px, 4.6vw, 44px)" }}>城堡托我们带一句话给你</h2>
          <p style={{ color: "var(--ink-soft)", maxWidth: "30em" }}>点击后有声音，也可以随时跳过。</p>
          <button className="btn" type="button" onClick={play}>接收邀请</button>
        </div>
      )}
      {started && <button className="book-skip" type="button" onClick={finish}>跳过</button>}
    </section>
  );
}
