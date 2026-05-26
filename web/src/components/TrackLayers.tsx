import { Music2 } from "lucide-react";
import type { ChallengeState } from "../core/challengeState";
import type { SongConfig, StemTrackId } from "../music/songCatalog";

const FALLBACK_LABELS: Record<StemTrackId, string> = {
  bass: "Bass",
  vocals: "Vocals",
  drums: "Drums",
  guitar: "Guitar",
  other: "Other",
};

export function TrackLayers({ challenge, song }: { challenge: ChallengeState; song: SongConfig }) {
  return (
    <section className="panel track-panel">
      <div className="panel-title">
        <Music2 size={18} />
        <span>音轨</span>
        <strong>{challenge.activeTracks.length}/{song.tracks.length}</strong>
      </div>
      <div className="track-list">
        {song.tracks.map((track) => (
          <div className="track-row" key={track.id}>
            <span>{track.label || FALLBACK_LABELS[track.id]}</span>
            <div className="volume-bar">
              <div style={{ width: `${(challenge.layerVolumes[track.id] ?? 0) * 100}%` }} />
            </div>
            <small>{(challenge.layerVolumes[track.id] ?? 0) > 0.01 ? "on" : "off"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
