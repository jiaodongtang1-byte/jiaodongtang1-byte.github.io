import { relativeBearingDeg } from "@/src/lib/radar";

type Props = {
  /** 目标相对正北的方位角 */
  bearingDeg: number;
  /** 手机朝向；没有罗盘时传 null，表盘只脉动不指方向 */
  headingDeg: number | null;
  /** 已经进入解锁半径：不再脉动 */
  arrived: boolean;
  muted?: boolean;
};

/** 雷达表盘。方位与朝向都在外面算好，这里只负责画。 */
export function Dial({ bearingDeg, headingDeg, arrived, muted }: Props) {
  const needle = headingDeg === null ? null : relativeBearingDeg(bearingDeg, headingDeg);
  return (
    <div className="dial" role="img" aria-label={needle === null ? "雷达：等待方向" : `雷达：目标在 ${Math.round(needle)} 度方向`}>
      <span className="dial-ring a" />
      <span className="dial-ring b" />
      {!arrived && !muted && <span className="dial-pulse" />}
      <span className="dial-core" />
      {needle !== null && <span className="dial-needle" style={{ transform: `rotate(${needle}deg)` }} />}
    </div>
  );
}
