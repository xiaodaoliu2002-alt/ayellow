import { Link2, Timer, Zap } from "lucide-react";
import type { ChallengeState } from "../core/challengeState";
import type { SyncState } from "../core/syncState";

interface SyncPanelProps {
  sync: SyncState;
  challenge: ChallengeState;
}

export function SyncPanel({ sync, challenge }: SyncPanelProps) {
  const progress = challenge.stage === 4 ? 1 : challenge.progressSeconds / challenge.stageSeconds;

  return (
    <section className="panel sync-panel">
      <div className="panel-title">
        <Link2 size={18} />
        <span>阶段 {challenge.stage}/4</span>
        <strong>{sync.synced ? "保持中" : sync.reason}</strong>
      </div>
      <div className="sync-number">
        <span>{Math.floor(challenge.progressSeconds)}</span>
        <small>秒</small>
      </div>
      <div className="progress">
        <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </div>
      <div className="sync-details">
        <span>
          <Timer size={15} />
          {challenge.stage === 4 ? "挑战完成" : `本阶段 ${Math.ceil(challenge.stageSeconds - challenge.progressSeconds)}s`}
        </span>
        <span>
          <Zap size={15} />
          差值 {(sync.tempoDeltaPercent * 100).toFixed(1)}%
        </span>
        <span>稳定 {(sync.stabilityPercent * 100).toFixed(1)}%</span>
      </div>
    </section>
  );
}
