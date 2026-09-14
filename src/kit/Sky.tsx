import { useMemo, type CSSProperties } from "react";

/** 星星用固定种子散布，避免每次渲染位置都跳。 */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

type Props = {
  /** 星星数量 */
  stars?: number;
  /** 云朵数量；0 = 不画云 */
  clouds?: number;
  /** 仙尘光点数量；0 = 不画仙尘（成绩页等静态场合用） */
  dust?: number;
  seed?: number;
  className?: string;
};

/**
 * 柔光天：几团云 + 柔光星点 + 一道斜着划过的仙尘。
 * 全站所有屏幕共用这一层，换屏时不重建，所以星星不会重跳。
 */
export function Sky({ stars = 58, clouds = 5, dust = 10, seed = 20261009, className = "" }: Props) {
  const { starList, cloudList, dustList } = useMemo(() => {
    const rand = seeded(seed);
    const starList = Array.from({ length: stars }, (_, index) => ({
      left: rand() * 100,
      top: rand() * 100,
      size: 1 + rand() * 2.1,
      delay: -rand() * 6,
      far: index % 3 === 0,
    }));
    const dustList = Array.from({ length: dust }, (_, index) => ({
      left: -8 + rand() * 30,
      top: 34 + rand() * 46,
      dx: 26 + rand() * 34,
      dy: -(18 + rand() * 24),
      delay: -(index * 1.35 + rand()),
    }));
    const cloudList = Array.from({ length: clouds }, () => ({
      left: -14 + rand() * 120,
      top: 4 + rand() * 62,
      width: 120 + rand() * 210,
      height: 52 + rand() * 62,
      delay: -rand() * 40,
    }));
    return { starList, cloudList, dustList };
  }, [stars, clouds, dust, seed]);

  return (
    <div className={`sky ${className}`.trim()} aria-hidden="true">
      {starList.map((star, index) => (
        <i
          key={`s${index}`}
          className={`sky-star ${star.far ? "is-far" : ""}`}
          style={{
            left: `${star.left}%`,
            top: `${star.top}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}
      {cloudList.map((cloud, index) => (
        <i
          key={`c${index}`}
          className="sky-cloud"
          style={{
            left: `${cloud.left}%`,
            top: `${cloud.top}%`,
            width: `${cloud.width}px`,
            height: `${cloud.height}px`,
            animationDelay: `${cloud.delay}s`,
          }}
        />
      ))}
      {dust > 0 && (
        <div className="sky-dust">
          {dustList.map((mote, index) => (
            <i
              key={`d${index}`}
              style={{
                left: `${mote.left}%`,
                top: `${mote.top}%`,
                animationDelay: `${mote.delay}s`,
                "--dx": `${mote.dx}vw`,
                "--dy": `${mote.dy}vh`,
              } as CSSProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
