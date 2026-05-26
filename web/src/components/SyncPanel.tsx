import { Link2, Timer, Zap } from "lucide-react";
import type { SyncState } from "../core/syncState";

interface SyncPanelProps {
  sync: SyncState;
}

export function SyncPanel({ sync }: SyncPanelProps) {
  const progress = sync.nextUnlockSeconds === null ? 1 : 1 - sync.nextUnlockSeconds / 60;

  return (
    <section className="panel sync-panel">
      <div className="panel-title">
        <Link2 size={18} />
        <span>同步</span>
        <strong>{sync.synced ? "保持中" : sync.reason}</strong>
      </div>
      <div className="sync-number">
        <span>{Math.floor(sync.syncedSeconds)}</span>
        <small>秒</small>
      </div>
      <div className="progress">
        <div style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
      </div>
      <div className="sync-details">
        <span>
          <Timer size={15} />
          {sync.nextUnlockSeconds === null ? "全部解锁" : `下一层 ${Math.ceil(sync.nextUnlockSeconds)}s`}
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
