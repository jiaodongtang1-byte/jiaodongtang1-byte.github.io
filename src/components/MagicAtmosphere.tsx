import type { CSSProperties } from "react";
import type { Checkpoint, StoryProgress } from "@/src/types";
import { CinematicComet } from "./CinematicComet";

type Props = {
  phase: StoryProgress["phase"];
  giftType: Checkpoint["giftType"];
  awake?: boolean;
};

const motes = [
  [7, 18, 0.5, 10, -2.1], [13, 73, 0.8, 14, -6.4], [21, 42, 0.45, 12, -8.2],
  [31, 86, 0.7, 16, -3.7], [42, 22, 0.55, 13, -9.1], [52, 68, 0.9, 18, -1.4],
  [63, 39, 0.5, 15, -4.8], [70, 82, 0.65, 11, -7.3], [78, 14, 0.8, 17, -5.6],
  [87, 58, 0.46, 13, -10.4], [94, 29, 0.72, 19, -2.8], [97, 79, 0.55, 14, -8.9],
];

export function MagicAtmosphere({ phase, giftType, awake = true }: Props) {
  return (
    <div className={`magic-atmosphere ${awake ? "is-awake" : ""}`} data-phase={phase} data-gift={giftType} aria-hidden="true">
      <div className="atlas-constellation-veil veil-one" />
      <div className="atlas-constellation-veil veil-two" />
      <div className="atlas-gilded-frame" />
      <div className="atlas-edge-glints"><i/><i/><i/><i/></div>
      <div className="cinematic-fog cinematic-fog-primary" />
      <div className="cinematic-fog cinematic-fog-secondary" />
      <div className="cinematic-rune-field" />
      <div className="ambient-motes">
        {motes.map(([x, y, scale, duration, delay], index) => (
          <i
            key={index}
            style={{
              "--mote-x": `${x}%`,
              "--mote-y": `${y}%`,
              "--mote-scale": scale,
              "--mote-duration": `${duration}s`,
              "--mote-delay": `${delay}s`,
            } as CSSProperties}
          />
        ))}
      </div>

      <svg className="star-dial star-dial-left" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="48" />
        <circle cx="60" cy="60" r="36" />
        <path d="M60 9v15M60 96v15M9 60h15M96 60h15M24 24l11 11M85 85l11 11M96 24 85 35M35 85 24 96" />
        <path className="star-marks" d="M60 17 68 34 86 35 73 48 77 67 60 58 43 67 47 48 34 35 52 34Z" />
      </svg>
      <svg className="star-dial star-dial-right" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="47" />
        <path d="M60 13 72 43 106 60 72 77 60 107 48 77 14 60 48 43Z" />
        <path className="star-marks" d="M43 30q17-12 34 0M90 43q12 17 0 34M77 90q-17 12-34 0M30 77q-12-17 0-34" />
      </svg>

      <div className="fairy-wand">
        <svg viewBox="0 0 96 122">
          <path className="wand-grip" d="M14 114 30 84" />
          <path className="wand-rod" d="M30 84 70 14" />
          <path className="wand-star" d="M74 4 79 22 96 27 79 32 74 50 69 32 52 27 69 22Z" />
        </svg>
        <span className="wand-trail" />
      </div>

      <div className="comet-trail-shadow" />
      <div className="comet-wake"><i/><i/><i/><i/></div>
      <div className="courier-comet"><CinematicComet className="comet-courier-hero" /></div>
      <div className="comet-spark-burst"><i/><i/><i/><i/><i/><i/></div>
      <div className="magic-edge magic-edge-top" />
      <div className="magic-edge magic-edge-bottom" />
    </div>
  );
}
