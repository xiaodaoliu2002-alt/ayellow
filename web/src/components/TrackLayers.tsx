import { Music2 } from "lucide-react";
import type { SyncState, TrackId } from "../core/syncState";

const LABELS: Record<TrackId, string> = {
  bass: "Bass",
  lead: "Vocals",
  drums: "Drums",
  piano: "Piano",
  guitar: "Guitar",
  pad: "Other",
};

const ORDER: TrackId[] = ["drums", "bass", "lead", "piano", "guitar", "pad"];

export function TrackLayers({ sync }: { sync: SyncState }) {
  return (
    <section className="panel track-panel">
      <div className="panel-title">
        <Music2 size={18} />
        <span>音轨</span>
        <strong>{sync.unlockedTracks.length}/6</strong>
      </div>
      <div className="track-list">
        {ORDER.map((track) => (
          <div className="track-row" key={track}>
            <span>{LABELS[track]}</span>
            <div className="volume-bar">
              <div style={{ width: `${sync.layerVolumes[track] * 100}%` }} />
            </div>
            <small>{sync.layerVolumes[track] > 0.01 ? "on" : "off"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
