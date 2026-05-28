import { Link2, Timer, Zap } from "lucide-react";
import type { ChallengeState } from "../core/challengeState";
import type { SyncState } from "../core/syncState";

interface SyncPanelProps {
  sync: SyncState;
  challenge: ChallengeState;
}

export function SyncPanel({ sync, challenge }: SyncPanelProps) {
  const detecting = challenge.preStageSecondsRemaining > 0;
  const holding = challenge.holdSecondsRemaining > 0;
  const progress = detecting ? 1 - challenge.preStageSecondsRemaining / 15 : challenge.stage === 4 ? 1 : challenge.progressSeconds / challenge.stageSeconds;

  return (
    <section className="panel sync-panel">
      <div className="panel-title">
        <Link2 size={18} />
        <span>{detecting ? "预检测" : `阶段 ${challenge.stage}/4`}</span>
        <strong>{detecting ? "争夺鼓轨" : sync.synced ? "保持中" : sync.reason}</strong>
      </div>
      <div className="sync-number">
        <span>{detecting ? Math.ceil(challenge.preStageSecondsRemaining) : Math.floor(challenge.progressSeconds)}</span>
        <small>{detecting ? "秒后开始" : "秒"}</small>
      </div>
      <div className="progress">
        <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </div>
      <div className="sync-details">
        <span>
          <Timer size={15} />
          {detecting
            ? `检测 ${Math.ceil(challenge.preStageSecondsRemaining)}s`
            : challenge.stage === 4
              ? "挑战完成"
              : holding
                ? `稳定 ${Math.ceil(challenge.holdSecondsRemaining)}s`
                : `本阶段 ${Math.ceil(challenge.stageSeconds - challenge.progressSeconds)}s`}
        </span>
        <span>
          <Zap size={15} />
          差值 {(sync.tempoDeltaPercent * 100).toFixed(1)}%
        </span>
        <span>{challenge.drumController === null ? "鼓轨待定" : `鼓轨 ${challenge.drumController === "user1" ? "用户 1" : "用户 2"}`}</span>
      </div>
    </section>
  );
}
