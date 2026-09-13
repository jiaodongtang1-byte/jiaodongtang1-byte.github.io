/** 三件信物的金色线描。全部手写 SVG path，不依赖位图。 */
export type RelicKind = "slipper" | "mirror" | "key" | "crown";

const BOX = "0 0 160 120";

/** 线宽随视口走，缩到手机上也不会糊成一条 */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <svg className="relic" viewBox={BOX} aria-hidden="true">
      {children}
    </svg>
  );
}

/**
 * 玻璃鞋：一条闭合轮廓（鞋头在左、鞋口下凹、后帮高、细跟在右）。
 * ⚠️ 侧影本身就是个团，之前试了九稿才有一条读得出是鞋——改 path 前先单独渲染看一眼。
 */
export const Slipper = (
  <Frame>
    <path className="relic-line" d="M16 98C12 80 30 68 52 70c16 2 30 12 40 22 8-12 18-24 28-30 8 6 10 24 6 38H104C66 104 34 104 16 98Z" />
    <path className="relic-line" d="M104 100 98 118M114 100 112 118M98 118h16" />
    <path className="relic-spark" d="M42 16 45 27 56 30 45 33 42 44 39 33 28 30 39 27Z" />
  </Frame>
);

export const Mirror = (
  <Frame>
    <ellipse className="relic-line" cx="80" cy="52" rx="30" ry="37" />
    <ellipse className="relic-line" cx="80" cy="52" rx="21" ry="28" />
    <path className="relic-line" d="M80 89v18M67 107h26" />
    <path className="relic-glow" d="M80 30c9 9 13 17 13 24 0 9-6 15-13 15s-13-6-13-15c0-7 4-15 13-24Z" />
    <path className="relic-spark" d="M128 20 131 31 142 34 131 37 128 48 125 37 114 34 125 31Z" />
  </Frame>
);

export const Key = (
  <Frame>
    <circle className="relic-line" cx="44" cy="60" r="24" />
    <circle className="relic-line" cx="44" cy="60" r="12" />
    <path className="relic-line" d="M68 60h62" />
    <path className="relic-line" d="M106 60v17M122 60v12" />
    <path className="relic-glow" d="M44 36a24 24 0 0 0 0 48 24 24 0 0 0 0-48Zm0 12a12 12 0 1 1 0 24 12 12 0 0 1 0-24Z" />
    <path className="relic-spark" d="M134 22 137 33 148 36 137 39 134 50 131 39 120 36 131 33Z" />
  </Frame>
);

export const Crown = (
  <Frame>
    <path className="relic-line" d="M26 92h108l-8-52-24 22-22-34-22 34-24-22z" />
    <path className="relic-line" d="M26 92h108v10H26z" />
    <circle className="relic-glow" cx="58" cy="40" r="5" />
    <circle className="relic-glow" cx="80" cy="30" r="5" />
    <circle className="relic-glow" cx="102" cy="40" r="5" />
    <path className="relic-glow" d="M80 62l4 10 11 1-8 8 2 11-9-6-9 6 2-11-8-8 11-1z" />
  </Frame>
);

export const RELICS: Record<RelicKind, React.ReactNode> = {
  slipper: Slipper,
  mirror: Mirror,
  key: Key,
  crown: Crown,
};
