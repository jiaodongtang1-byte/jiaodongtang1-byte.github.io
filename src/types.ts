/** 全站共用的数据类型。旧版的 Checkpoint / ExplorationZone / GiftType 已随旧模型删除。 */

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** 照片比对模式：连姿势一起比，还是只比场景。 */
export type MatchMode = "pose-scene" | "scene-only";

export type PositionSample = LatLng & {
  accuracy: number;
  timestamp: number;
  heading?: number;
};

export type RouteMatch = {
  progress: number;
  distanceFromRouteM: number;
  distanceToCheckpointM: number;
};

export type CapturedPhoto = {
  id: string;
  /** 属于哪一站 */
  checkpointId: string;
  dataUrl: string;
  score: number;
  createdAt: number;
};

export type MatchResult = {
  score: number;
  sceneScore: number;
  poseScore: number | null;
  subjectScore: number;
  message: string;
};

/** 流程停在哪儿。存档会读这个值决定恢复到哪里。 */
export type Stage = "cover" | "film" | "hunt" | "capture" | "reveal" | "between" | "finale";

export type StoryProgress = {
  /** 当前第几站（0 起） */
  index: number;
  /** 已揭晓的站 id */
  solvedIds: string[];
  /** 已经走到过（进入解锁半径）的站 id */
  arrivedIds: string[];
  /** 每站拍了几次 */
  attempts: Record<string, number>;
  photoIds: string[];
  stage: Stage;
  /** 本站是否已经点过"我已到达" */
  started: boolean;
};
