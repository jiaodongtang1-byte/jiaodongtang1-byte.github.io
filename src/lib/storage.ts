import { openDB } from "idb";
import type { CapturedPhoto, StoryProgress } from "@/src/types";
import { initialProgress } from "@/src/progress";

const DB_NAME = "exploration-atlas";
const DB_VERSION = 1;

const STAGES = ["cover", "film", "hunt", "capture", "reveal", "between", "finale"];

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** 存档是外部输入（可能来自被改过的 IndexedDB），所以逐字段验一遍再信。 */
function isStoryProgress(value: unknown): value is StoryProgress {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<StoryProgress>;
  return (
    Number.isInteger(c.index) &&
    Number(c.index) >= 0 &&
    isStringArray(c.solvedIds) &&
    isStringArray(c.arrivedIds) &&
    isStringArray(c.photoIds) &&
    Boolean(c.attempts) &&
    typeof c.attempts === "object" &&
    Object.values(c.attempts ?? {}).every((n) => Number.isInteger(n) && Number(n) >= 0) &&
    STAGES.includes(String(c.stage)) &&
    typeof c.started === "boolean"
  );
}

function databaseName(namespace = "formal") {
  if (namespace === "formal") return DB_NAME;
  const safeNamespace = namespace.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48);
  return `${DB_NAME}-${safeNamespace || "test"}`;
}

async function getDb(namespace = "formal") {
  return openDB(databaseName(namespace), DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("photos")) {
        const photos = db.createObjectStore("photos", { keyPath: "id" });
        photos.createIndex("checkpointId", "checkpointId");
      }
      if (!db.objectStoreNames.contains("references")) db.createObjectStore("references");
    },
  });
}

export async function loadProgress(
  namespace = "formal",
  fallbackProgress: StoryProgress = initialProgress,
): Promise<StoryProgress> {
  try {
    const db = await getDb(namespace);
    const saved = await db.get("state", "progress");
    return isStoryProgress(saved) ? saved : structuredClone(fallbackProgress);
  } catch {
    return structuredClone(fallbackProgress);
  }
}

export async function saveProgress(progress: StoryProgress, namespace = "formal") {
  const db = await getDb(namespace);
  await db.put("state", progress, "progress");
}

export async function resetProgress(
  keepPhotos = true,
  namespace = "formal",
  fallbackProgress: StoryProgress = initialProgress,
) {
  const db = await getDb(namespace);
  await db.put("state", structuredClone(fallbackProgress), "progress");
  if (!keepPhotos) {
    await db.clear("photos");
    await db.clear("references");
  }
}

export async function savePhoto(photo: CapturedPhoto, namespace = "formal") {
  const db = await getDb(namespace);
  await db.put("photos", photo);
}

export async function getPhotos(namespace = "formal"): Promise<CapturedPhoto[]> {
  const db = await getDb(namespace);
  const photos = (await db.getAll("photos")).filter(
    (photo): photo is CapturedPhoto =>
      Boolean(photo) &&
      typeof photo.id === "string" &&
      typeof photo.checkpointId === "string" &&
      typeof photo.dataUrl === "string" &&
      Number.isFinite(photo.score) &&
      Number.isFinite(photo.createdAt),
  );
  return photos.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveReference(checkpointId: string, dataUrl: string, namespace = "formal") {
  const db = await getDb(namespace);
  await db.put("references", dataUrl, checkpointId);
}

export async function getReference(checkpointId: string, namespace = "formal"): Promise<string | undefined> {
  const db = await getDb(namespace);
  return db.get("references", checkpointId);
}

export async function clearReference(checkpointId: string, namespace = "formal") {
  const db = await getDb(namespace);
  await db.delete("references", checkpointId);
}
