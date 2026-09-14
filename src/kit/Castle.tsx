import type { CSSProperties } from "react";

/**
 * 城堡：整个 App 的招牌画面。
 * 不是哥特尖塔，是迪士尼片头那种**圆润、灯火通明**的城堡——塔身宽、屋顶圆、
 * 窗子有光、顶上飘旗。全部用 SVG 画，不依赖位图。
 */
export function Castle({ className = "" }: { className?: string }) {
  return (
    <svg className={`castle ${className}`.trim()} viewBox="0 0 480 240" aria-hidden="true">
      {/* 五座塔：中间最大、越往外越矮，塔身宽大于高才不像栅栏 */}
      <path className="castle-body" d="M48 222v-54h44v54z" />
      <path className="castle-roof" d="M42 168 70 128l28 40z" />
      <path className="castle-body" d="M388 222v-54h44v54z" />
      <path className="castle-roof" d="M382 168 410 128l28 40z" />

      <path className="castle-body" d="M112 222v-82h56v82z" />
      <path className="castle-roof" d="M106 140 140 90l34 50z" />
      <path className="castle-body" d="M312 222v-82h56v82z" />
      <path className="castle-roof" d="M306 140 340 90l34 50z" />

      <path className="castle-body" d="M194 222v-110h92v110z" />
      <path className="castle-roof" d="M186 112 240 44l54 68z" />

      {/* 连墙：把塔串成一座城堡，而不是五个独立方块 */}
      <path className="castle-body" d="M92 198h296v24H92z" />
      <path className="castle-body" d="M92 198h12v-10h12v10h16v-10h12v10h16v-10h12v10h16v-10h12v10h16v-10h12v10h16v-10h12v10h16v-10h12v10h16v-10h12v10h16v-10h12v10h8" />

      {/* 城门 */}
      <path className="castle-body" d="M216 222v-30a24 24 0 0 1 48 0v30z" />

      {/* 灯火：小拱窗，不用大圆块 */}
      <rect className="castle-window" x="216" y="138" width="8" height="14" rx="4" />
      <rect className="castle-window is-dim" x="256" y="138" width="8" height="14" rx="4" />
      <rect className="castle-window is-dim" x="216" y="172" width="8" height="14" rx="4" />
      <rect className="castle-window" x="256" y="172" width="8" height="14" rx="4" />
      <rect className="castle-window" x="236" y="80" width="8" height="14" rx="4" />
      <rect className="castle-window" x="128" y="162" width="7" height="12" rx="3.5" />
      <rect className="castle-window is-dim" x="146" y="186" width="7" height="12" rx="3.5" />
      <rect className="castle-window is-dim" x="328" y="162" width="7" height="12" rx="3.5" />
      <rect className="castle-window" x="346" y="186" width="7" height="12" rx="3.5" />
      <rect className="castle-window" x="60" y="188" width="6" height="11" rx="3" />
      <rect className="castle-window is-dim" x="400" y="188" width="6" height="11" rx="3" />

      {/* 旗帜 */}
      <path className="castle-flag" d="M240 44V16l22 7-22 7z" />
      <path className="castle-flag" d="M140 90V66l18 6-18 6z" />
      <path className="castle-flag" d="M340 90V66l-18 6 18 6z" />
    </svg>
  );
}

type FireworkProps = {
  /** 烟花爆点，百分比坐标 */
  spots?: Array<{ x: number; y: number; color: string; delay: number; rays?: number }>;
  className?: string;
};

const DEFAULT_SPOTS = [
  { x: 18, y: 16, color: "var(--rose)", delay: 0 },
  { x: 82, y: 22, color: "var(--gold)", delay: 1.1 },
  { x: 50, y: 8, color: "var(--mint)", delay: 2.2 },
  { x: 32, y: 30, color: "var(--violet)", delay: 3.0 },
  { x: 70, y: 12, color: "var(--rose)", delay: 4.1 },
];

/**
 * 烟花：每一朵是 N 条射线 + 一圈扩散环。
 * 射线用 rotate + translate 摆位，纯 CSS 动，不跑 JS 动画。
 */
export function Fireworks({ spots = DEFAULT_SPOTS, className = "" }: FireworkProps) {
  return (
    <div className={`fireworks ${className}`.trim()} aria-hidden="true">
      {spots.map((spot, index) => {
        const rays = spot.rays ?? 12;
        return (
          <div
            key={index}
            className="firework"
            style={{
              "--fx": `${spot.x}%`,
              "--fy": `${spot.y}%`,
              "--fc": spot.color,
              animationDelay: `${spot.delay}s`,
            } as CSSProperties}
          >
            {Array.from({ length: rays }, (_, ray) => (
              <i key={ray} style={{ transform: `rotate(${(360 / rays) * ray}deg) translateY(-40px)` }} />
            ))}
            <span className="firework-ring" />
          </div>
        );
      })}
    </div>
  );
}
