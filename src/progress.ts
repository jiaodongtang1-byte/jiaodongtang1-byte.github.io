import { STATIONS } from "@/src/story";
import type { StoryProgress } from "@/src/types";

/** 存档初始值：从故事推导，不手写 id——改站点不会漏改存档。 */
export const initialProgress: StoryProgress = {
  index: 0,
  solvedIds: [],
  arrivedIds: [],
  attempts: {},
  photoIds: [],
  stage: "cover",
  started: false,
};

/** 存档版本号，将来改结构时用来判断要不要丢档。 */
export const SAVE_VERSION = 2;

export const stationAt = (index: number) => STATIONS[Math.min(Math.max(0, index), STATIONS.length - 1)];
