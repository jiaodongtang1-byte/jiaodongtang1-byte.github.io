import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Cover } from "@/src/screens/Cover";
import { Storybook } from "@/src/screens/Storybook";
import { Hunt } from "@/src/screens/Hunt";
import { Capture } from "@/src/screens/Capture";
import { Reveal } from "@/src/screens/Reveal";
import { Finale } from "@/src/screens/Finale";
import { Guide, GuideGate } from "@/src/screens/Guide";
import { Sky } from "@/src/kit/Sky";
import { Castle, Fireworks } from "@/src/kit/Castle";
import { BETWEEN, LETTER, STATIONS } from "@/src/story";
import { initialProgress } from "@/src/progress";
import { loadProgress, saveProgress, resetProgress, savePhoto, getPhotos } from "@/src/lib/storage";
import { bearingDegrees, haversineDistance, isInsideCheckpoint, smoothPositionSample } from "@/src/lib/geo";
import { useGeolocation } from "@/src/hooks/useGeolocation";
import { useDeviceHeading } from "@/src/hooks/useDeviceHeading";
import { useMagicalSoundscape } from "@/src/hooks/useMagicalSoundscape";
import type { CapturedPhoto, MatchResult, PositionSample, StoryProgress } from "@/src/types";

/** 定位精度差于此值就不认（城区楼间留一档余量）。 */
const MAX_ACCURACY_M = 120;
/** 连续几次进入半径才算抵达：一次飘进来的点不算数。 */
const ARRIVE_STREAK = 2;

type Props = {
  /** ?run=test 走查用：存档独立，终章多一个「重新走一遍」 */
  namespace: string;
};

export default function App({ namespace }: Props) {
  const rehearsal = namespace !== "formal";
  const [progress, setProgress] = useState<StoryProgress>(initialProgress);
  const [loaded, setLoaded] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [position, setPosition] = useState<PositionSample | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [gate, setGate] = useState<"none" | "pin" | "open">("none");
  const [toast, setToast] = useState<string | null>(null);
  const streak = useRef(0);
  const holdRef = useRef<number | null>(null);

  const station = STATIONS[Math.min(progress.index, STATIONS.length - 1)];
  const location = useGeolocation(progress.stage !== "cover");
  const heading = useDeviceHeading();
  const music = useMagicalSoundscape();

  /* ---------- 存档 ---------- */
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [saved, shots] = await Promise.all([loadProgress(namespace), getPhotos(namespace)]);
      if (!alive) return;
      setProgress(saved);
      setPhotos(shots);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, [namespace]);

  useEffect(() => {
    if (!loaded) return;
    void saveProgress(progress, namespace);
  }, [progress, loaded, namespace]);

  /* ---------- 定位 ---------- */
  useEffect(() => {
    if (location.sample) setPosition((prev) => smoothPositionSample(prev, location.sample!));
  }, [location.sample]);

  const reliable = location.status === "active" && (position?.accuracy ?? Infinity) <= MAX_ACCURACY_M;

  const distanceM = useMemo(
    () => (position ? haversineDistance(position, station.location) : Number.POSITIVE_INFINITY),
    [position, station.location],
  );

  const inside = useMemo(
    () => (position
      ? isInsideCheckpoint(distanceM, position.accuracy, station.radiusM, MAX_ACCURACY_M)
      : false),
    [position, distanceM, station.radiusM],
  );

  const arrived = progress.arrivedIds.includes(station.id);

  // 连续两次进圈才算抵达，避免一个飘点直接把信物送出去
  useEffect(() => {
    if (progress.stage !== "hunt" || !progress.started || arrived) { streak.current = 0; return; }
    streak.current = inside ? streak.current + 1 : 0;
    if (streak.current >= ARRIVE_STREAK) {
      streak.current = 0;
      setProgress((p) => ({ ...p, arrivedIds: [...new Set([...p.arrivedIds, station.id])] }));
    }
  }, [inside, progress.stage, progress.started, arrived, station.id]);

  const setStage = useCallback((stage: StoryProgress["stage"]) => {
    setProgress((p) => ({ ...p, stage }));
  }, []);

  /* ---------- 引路人暗门：长按指南针 ---------- */
  const beginHold = () => {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => setGate("pin"), 3000);
  };
  const endHold = () => {
    if (holdRef.current) { window.clearTimeout(holdRef.current); holdRef.current = null; }
  };

  /* ---------- 动作 ---------- */
  function startHunt() {
    setProgress((p) => ({ ...p, stage: "film" }));
  }

  function openCapture() {
    setGate("none");
    setAttempts(progress.attempts[station.id] ?? 0);
    setStage("capture");
  }

  async function handleResult(result: MatchResult, dataUrl: string) {
    const photo: CapturedPhoto = {
      id: `${station.id}-${Date.now()}`,
      checkpointId: station.id,
      dataUrl,
      score: result.score,
      createdAt: Date.now(),
    };
    await savePhoto(photo, namespace);
    setPhotos((prev) => [...prev, photo]);
    setProgress((p) => ({
      ...p,
      solvedIds: [...new Set([...p.solvedIds, station.id])],
      photoIds: [...p.photoIds, photo.id],
      attempts: { ...p.attempts, [station.id]: (p.attempts[station.id] ?? 0) + 1 },
      stage: "reveal",
    }));
  }

  function afterReveal() {
    const last = progress.index >= STATIONS.length - 1;
    if (last) { setStage("finale"); return; }
    setStage("between");
  }

  function nextStation() {
    setProgress((p) => ({ ...p, index: p.index + 1, started: false, stage: "hunt" }));
    setToast(null);
    location.retry();
  }

  async function doReset(keepPhotos: boolean) {
    await resetProgress(keepPhotos, namespace, initialProgress);
    setProgress({ ...initialProgress });
    setPhotos(keepPhotos ? await getPhotos(namespace) : []);
    setGate("none");
  }

  async function share(photo: CapturedPhoto) {
    try {
      const response = await fetch(photo.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `${station.id}.jpg`, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: LETTER.title });
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      setToast("这张照片暂时存不下来，长按图片可以手动保存。");
    }
  }

  if (!loaded) {
    return (
      <section className="screen screen-center">
        <Sky stars={40} dust={0} />
        <Castle className="castle" />
        <span className="eyebrow">正在点亮城堡的灯……</span>
      </section>
    );
  }

  return (
    <div className="app">
      {progress.stage === "cover" && (
        <Cover
          opening={false}
          ready={{ location: location.status === "active", camera: true, offline: true }}
          onStart={startHunt}
        />
      )}

      {progress.stage === "film" && <Storybook onDone={() => setStage("hunt")} />}

      {(progress.stage === "hunt" || progress.stage === "capture" || progress.stage === "reveal") && (
        <section className="screen" aria-label="寻宝">
          <Hunt
            index={progress.index}
            position={position}
            reliable={reliable}
            arrived={arrived}
            started={progress.started}
            heading={heading.heading}
            muted={music.muted}
            distanceM={distanceM}
            onStart={() => { setProgress((p) => ({ ...p, started: true })); location.retry(); }}
            onOpenCapture={openCapture}
            onRetry={location.retry}
          />
        </section>
      )}

      {progress.stage === "capture" && (
        <Capture
          station={station}
          attempt={attempts}
          onCancel={() => setStage("hunt")}
          onResult={(result, url) => void handleResult(result, url)}
        />
      )}

      {progress.stage === "reveal" && (
        <Reveal
          station={station}
          score={photos.find((p) => p.checkpointId === station.id)?.score ?? 100}
          last={progress.index >= STATIONS.length - 1}
          onNext={afterReveal}
        />
      )}

      {progress.stage === "between" && (
        <section className="screen between">
          <Sky stars={52} dust={8} seed={index_seed(progress.index)} />
          <div className="inner">
            <div className="seal">
              <svg viewBox="0 0 48 48"><path d="M10 34h28l-3-16-8 7-7-11-7 11-8-7z" fill="currentColor" /></svg>
            </div>
            <span className="eyebrow">{BETWEEN[Math.min(progress.index, BETWEEN.length - 1)].eyebrow}</span>
            <h2>{BETWEEN[Math.min(progress.index, BETWEEN.length - 1)].body}</h2>
            <button className="btn" type="button" onClick={nextStation}>
              {BETWEEN[Math.min(progress.index, BETWEEN.length - 1)].button}
            </button>
          </div>
        </section>
      )}

      {progress.stage === "finale" && (
        <Finale photos={photos} rehearsal={rehearsal} onReset={() => void doReset(true)} onShare={(p) => void share(p)} />
      )}

      {/* 常驻小工具：音乐 + 指南针（长按 3 秒进控制台） */}
      {progress.stage !== "film" && (
        <>
          <div className="tools is-left">
            <button
              className="tool-btn"
              type="button"
              aria-label={music.muted ? "打开音乐" : "关闭音乐"}
              onClick={music.toggle}
            >
              {music.muted ? "♪̸" : "♪"}
            </button>
          </div>
          <div className="tools is-right">
            <button
              className="tool-btn is-big is-spinning"
              type="button"
              aria-label="指南针"
              onPointerDown={beginHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
            >✦</button>
          </div>
        </>
      )}

      {gate === "pin" && <GuideGate onCancel={() => setGate("none")} onSubmit={() => setGate("open")} />}
      {gate === "open" && (
        <Guide
          index={progress.index}
          position={position}
          distanceM={distanceM}
          onClose={() => setGate("none")}
          onForceArrive={() => {
            setProgress((p) => ({
              ...p,
              arrivedIds: [...new Set([...p.arrivedIds, station.id])],
              started: true,
              stage: "hunt",
            }));
            setGate("none");
          }}
          onForceSolved={() => { setGate("none"); void handleResult({ score: 100, sceneScore: 100, poseScore: null, subjectScore: 100, message: "强制" }, ""); }}
          onSkip={nextStation}
          onReset={(keep) => void doReset(keep)}
        />
      )}

      {toast && (
        <div className="veil-screen" style={{ zIndex: 90 }} onClick={() => setToast(null)}>
          <p style={{ color: "var(--ink)" }}>{toast}</p>
        </div>
      )}
    </div>
  );
}

function index_seed(index: number) {
  return 31 + index * 17;
}
