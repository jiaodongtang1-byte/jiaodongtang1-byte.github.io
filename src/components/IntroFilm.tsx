import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 开场短片（2026-09-13 重做）。
 *
 * 原来是一条 62 秒的 mp4（20MB），画面是羊皮纸书桌上的**羽毛笔**、字幕写着
 * 「迟到了二十二年」——羽毛笔是哈利波特的招牌，年岁也和收件人对不上（她 27 岁）。
 * 字幕烧在视频里改不动，所以整条换掉：改成**绘本翻页**，用 App 自己那套金色线描
 * 画星空、城堡和三件信物，文案写在这里随时可改。
 *
 * 原片的声音留下当配乐（20MB 视频 → 787KB 音频），加进 precache 的体积压力小得多。
 */
const INTRO_SCORE_SRC = "/assets/audio/intro-film-score.mp3";

/** 每页停留毫秒。配乐 62 秒，六页铺满。 */
const PAGE_MS = 9_600;
const BRIDGE_DURATION_MS = 880;

type IntroFilmProps = {
  onTransitionStart: () => void;
  onComplete: () => void;
};

type FilmStage = "cover" | "playing" | "bridging";

export function IntroFilm({ onTransitionStart, onComplete }: IntroFilmProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<FilmStage>("cover");
  const bridgeTimer = useRef<number | null>(null);
  const pageTimer = useRef<number | null>(null);
  const [stage, setStage] = useState<FilmStage>("cover");
  const [page, setPage] = useState(0);
  const [reduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const beginBridge = useCallback(() => {
    if (stageRef.current === "bridging") return;
    stageRef.current = "bridging";
    setStage("bridging");
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    onTransitionStart();
    bridgeTimer.current = window.setTimeout(onComplete, reduced ? 90 : BRIDGE_DURATION_MS);
  }, [onComplete, onTransitionStart, reduced]);

  useEffect(
    () => () => {
      if (bridgeTimer.current) window.clearTimeout(bridgeTimer.current);
      if (pageTimer.current) window.clearTimeout(pageTimer.current);
      audioRef.current?.pause();
    },
    [],
  );

  // 翻页：每 PAGE_MS 走一页，翻完最后一页进转场。自动播放不会失败，所以没有 error 分支。
  useEffect(() => {
    if (stage !== "playing") return;
    pageTimer.current = window.setTimeout(() => {
      setPage((current) => {
        if (current + 1 < FILM_PAGES.length) return current + 1;
        beginBridge();
        return current;
      });
    }, reduced ? 900 : PAGE_MS);
    return () => {
      if (pageTimer.current) window.clearTimeout(pageTimer.current);
    };
  }, [beginBridge, page, reduced, stage]);

  function playFilm() {
    stageRef.current = "playing";
    setStage("playing");
    setPage(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 1;
    void audio.play().catch(() => {
      /* 浏览器不给自动出声就静音播，画面照走 */
    });
  }

  function skipFilm() {
    beginBridge();
  }

  const current = FILM_PAGES[Math.min(page, FILM_PAGES.length - 1)];

  return (
    <section className={`intro-film-overlay is-${stage}`} data-film-stage={stage} aria-label="公主的回家短片">
      <div className="intro-film-media" aria-hidden={stage === "cover"}>
        <div className="intro-book">
          <SkyBackdrop />
          {FILM_PAGES.map((item, index) => (
            <div
              key={item.id}
              className={`intro-book-page ${index === page ? "is-current" : ""} ${index < page ? "is-past" : ""}`}
              data-page={item.id}
              aria-hidden={index !== page}
            >
              <div className="intro-book-art">{item.art}</div>
              <div className="intro-book-copy">
                <span>{item.eyebrow}</span>
                <h2>{item.title}</h2>
                <p>{item.line}</p>
              </div>
            </div>
          ))}
          <div className="intro-book-pager" aria-hidden="true">
            {FILM_PAGES.map((item, index) => (
              <i key={item.id} className={index <= page ? "is-on" : ""} />
            ))}
          </div>
        </div>
      </div>

      <audio ref={audioRef} src={INTRO_SCORE_SRC} preload="auto" onEnded={beginBridge} />

      {stage === "cover" && (
        <div className="intro-film-cover">
          <div className="intro-film-cover-copy">
            <span>A ROYAL LETTER · FOR THE PRINCESS</span>
            <h1>一封只交给公主的信</h1>
            <p>星星已经排好了队，等你翻开。</p>
          </div>
          <button className="intro-film-start" type="button" onClick={playFilm}>
            <i aria-hidden="true" />
            <b>开始接收邀请</b>
          </button>
          <small>点击后有声音 · 也可以直接跳过</small>
        </div>
      )}

      {stage === "playing" && (
        <button className="intro-film-skip" type="button" onClick={skipFilm}>
          跳过片头
        </button>
      )}

      <div className="intro-film-paper-flash" aria-hidden="true" />
      <div className="intro-film-seal-bridge" aria-hidden="true"><i /></div>
      <span className="visually-hidden">{current.title}</span>
    </section>
  );
}

/* ---------- 插画：全部是金色线描，和 App 里的星盘/花框一套语言 ---------- */

function SkyBackdrop() {
  const stars = [
    [8, 22, 1.6], [17, 68, 1.1], [26, 14, 1.3], [33, 82, 1.5], [41, 36, 1],
    [49, 74, 1.4], [56, 18, 1.2], [63, 58, 1.6], [72, 28, 1], [79, 80, 1.3],
    [86, 44, 1.5], [93, 66, 1.1], [12, 46, 1], [38, 92, 1.2], [68, 90, 1],
    [91, 12, 1.4], [5, 88, 1.1], [58, 6, 1],
  ];
  return (
    <svg className="intro-book-sky" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <radialGradient id="bookSkyGlow" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#21335f" />
          <stop offset="58%" stopColor="#101c3c" />
          <stop offset="100%" stopColor="#060a16" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#bookSkyGlow)" />
      {stars.map(([x, y, r], index) => (
        <circle key={index} className="book-star" cx={x} cy={y} r={r / 10} style={{ animationDelay: `${-index * 0.7}s` }} />
      ))}
    </svg>
  );
}

const SLIPPER = (
  <svg viewBox="0 0 160 120" aria-hidden="true">
    {/* 单条闭合轮廓：鞋头在左、鞋口下凹、后帮高、细跟在右。
        侧影本身就是个团，试了九稿才有一条读得出是鞋——改动前先渲染看一眼。 */}
    <path className="art-line" d="M16 98C12 80 30 68 52 70c16 2 30 12 40 22 8-12 18-24 28-30 8 6 10 24 6 38H104C66 104 34 104 16 98Z" />
    <path className="art-line" d="M104 100 98 118M114 100 112 118M98 118h16" />
    <path className="art-sparkle" d="M42 16 45 27 56 30 45 33 42 44 39 33 28 30 39 27Z" />
  </svg>
);

const MIRROR = (
  <svg viewBox="0 0 160 120" aria-hidden="true">
    <ellipse className="art-line" cx="80" cy="50" rx="30" ry="38" />
    <ellipse className="art-line" cx="80" cy="50" rx="22" ry="30" />
    <path className="art-line" d="M80 88v22M68 110h24" />
    <path className="art-fill" d="M80 30c8 8 12 16 12 22 0 8-6 14-12 14s-12-6-12-14c0-6 4-14 12-22Z" />
    <path className="art-sparkle" d="M124 22 127 32 137 35 127 38 124 48 121 38 111 35 121 32Z" />
  </svg>
);

const KEY = (
  <svg viewBox="0 0 160 120" aria-hidden="true">
    <circle className="art-line" cx="46" cy="60" r="22" />
    <circle className="art-line" cx="46" cy="60" r="11" />
    <path className="art-line" d="M68 60h58" />
    <path className="art-line" d="M104 60v16M118 60v11" />
    <path className="art-fill" d="M46 38a22 22 0 0 0 0 44 22 22 0 0 0 0-44Zm0 11a11 11 0 1 1 0 22 11 11 0 0 1 0-22Z" />
    <path className="art-sparkle" d="M132 26 135 36 145 39 135 42 132 52 129 42 119 39 129 36Z" />
  </svg>
);

const CASTLE = (
  <svg viewBox="0 0 320 200" aria-hidden="true">
    <path className="art-line" d="M120 176V86h80v90" />
    <path className="art-line" d="M120 86l13-13 13 13 14-13 13 13 14-13 13 13" />
    <path className="art-line" d="M62 176V100h44v76" />
    <path className="art-line" d="M52 100 84 44l32 56Z" />
    <path className="art-line" d="M214 176V100h44v76" />
    <path className="art-line" d="M204 100 236 44l32 56Z" />
    <path className="art-line" d="M84 44V20M236 44V20" />
    <path className="art-fill" d="M84 20 68 27l16 7ZM236 20l16 7-16 7Z" />
    <path className="art-line" d="M146 176v-30a14 14 0 0 1 28 0v30" />
    <path className="art-line" d="M30 176h260" />
    <path className="art-line" d="M104 122h14v18h-14zM202 122h14v18h-14zM154 100h12v16h-12z" />
    <path className="art-sparkle" d="M282 58 285 68 295 71 285 74 282 84 279 74 269 71 279 68Z" />
    <path className="art-sparkle" d="M30 34 33 44 43 47 33 50 30 60 27 50 17 47 27 44Z" />
  </svg>
);

const ENVELOPE = (
  <svg viewBox="0 0 320 200" aria-hidden="true">
    <path className="art-line" d="M52 62h216v104H52z" />
    <path className="art-line" d="M52 62 160 132 268 62" />
    <path className="art-line" d="M52 166 122 108M268 166 198 108" />
    <path className="art-fill" d="M160 44 166 62 185 64 171 76 175 95 160 85 145 95 149 76 135 64 154 62Z" />
    <path className="art-sparkle" d="M282 30 285 40 295 43 285 46 282 56 279 46 269 43 279 40Z" />
    <path className="art-sparkle" d="M36 142 39 152 49 155 39 158 36 168 33 158 23 155 33 152Z" />
  </svg>
);

type FilmPage = {
  id: string;
  eyebrow: string;
  title: string;
  line: string;
  art: React.ReactNode;
};

const FILM_PAGES: FilmPage[] = [
  {
    id: "star",
    eyebrow: "A LETTER ARRIVED",
    title: "一封迟到了二十七年的邀请",
    line: "有一份邀请，整整迟到了二十七年。",
    art: (
      <svg viewBox="0 0 320 200" aria-hidden="true">
        <path className="art-line" d="M30 150 Q150 96 292 44" />
        <path className="art-fill" d="M292 44 278 50 286 62 300 54Z" />
        <path className="art-sparkle" d="M250 74 253 84 263 87 253 90 250 100 247 90 237 87 247 84Z" />
        <path className="art-sparkle" d="M196 96 199 106 209 109 199 112 196 122 193 112 183 109 193 106Z" />
        <path className="art-sparkle" d="M138 118 141 128 151 131 141 134 138 144 135 134 125 131 135 128Z" />
        <path className="art-halfmoon" d="M74 62a30 30 0 1 0 22 44 24 24 0 1 1-22-44Z" />
      </svg>
    ),
  },
  {
    id: "castle",
    eyebrow: "THE KINGDOM WAS WAITING",
    title: "你不是普通人",
    line: "你是遗落在外的公主，王国一直在等你回去。",
    art: (
      <div className="royal-plate">
        <img src="/assets/art/princess-terrace.webp" alt="" />
      </div>
    ),
  },
  {
    id: "relic",
    eyebrow: "THREE HEIRLOOMS",
    title: "三件信物，藏在你走过的路上",
    line: "玻璃鞋、魔镜、王国的钥匙——每找到一件，星图就亮一分。",
    art: (
      <div className="intro-book-trio">
        <div>{SLIPPER}</div>
        <div>{MIRROR}</div>
        <div>{KEY}</div>
      </div>
    ),
  },
  {
    id: "relic-2",
    eyebrow: "THE GLASS SLIPPER",
    title: "第一件：玻璃鞋",
    line: "回家的路，从最不起眼的一道门开始。",
    art: SLIPPER,
  },
  {
    id: "relic-3",
    eyebrow: "THE MIRROR",
    title: "第二件：魔镜",
    line: "魔镜会告诉你，你真正的样子。",
    art: MIRROR,
  },
  {
    id: "home",
    eyebrow: "OCT 9 · 2026",
    title: "十月九日，我们接你回家",
    line: "乐园的灯为你亮起来的时候，所有的星星都排好了队。",
    art: ENVELOPE,
  },
];
