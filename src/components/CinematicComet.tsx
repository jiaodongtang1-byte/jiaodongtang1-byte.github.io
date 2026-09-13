type Props = {
  className?: string;
};

/** 划过夜空的那颗星。原来这里是信使猫头鹰（哈利波特的招牌），2026-09-13 换成流星。 */
export function CinematicComet({ className = "" }: Props) {
  return (
    <span className={`cinematic-comet ${className}`.trim()} aria-hidden="true">
      <i className="comet-tail" />
      <i className="comet-spark comet-spark-1" />
      <i className="comet-spark comet-spark-2" />
      <i className="comet-spark comet-spark-3" />
      <i className="comet-head" />
    </span>
  );
}
