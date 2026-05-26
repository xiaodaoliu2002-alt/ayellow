export type StemTrackId = "drums" | "guitar" | "bass" | "other" | "vocals";
export type SongId = "magic-potion" | "pavement-daybreak";

export interface StemTrackConfig {
  id: StemTrackId;
  label: string;
  path: string;
}

export interface SongConfig {
  id: SongId;
  title: string;
  artist: string;
  baseTracks: [StemTrackId, StemTrackId];
  rewardTracks: [StemTrackId, StemTrackId, StemTrackId];
  tracks: StemTrackConfig[];
}

const track = (id: StemTrackId, label: string, folder: string): StemTrackConfig => ({
  id,
  label,
  path: `/audio/${folder}/${id}.mp3`,
});

export const SONGS: SongConfig[] = [
  {
    id: "magic-potion",
    title: "给你一瓶魔法药水",
    artist: "告五人",
    baseTracks: ["drums", "guitar"],
    rewardTracks: ["bass", "other", "vocals"],
    tracks: [
      track("drums", "Drums", "magic-potion"),
      track("guitar", "Guitar", "magic-potion"),
      track("bass", "Bass", "magic-potion"),
      track("other", "Other", "magic-potion"),
      track("vocals", "Vocals", "magic-potion"),
    ],
  },
  {
    id: "pavement-daybreak",
    title: "Pavement at Daybreak",
    artist: "Pavement at Daybreak",
    baseTracks: ["drums", "guitar"],
    rewardTracks: ["bass", "other", "vocals"],
    tracks: [
      track("drums", "Drums", "pavement-daybreak"),
      track("guitar", "Guitar", "pavement-daybreak"),
      track("bass", "Bass", "pavement-daybreak"),
      track("other", "Other", "pavement-daybreak"),
      track("vocals", "Vocals", "pavement-daybreak"),
    ],
  },
];

export function findSong(songId: SongId): SongConfig {
  return SONGS.find((song) => song.id === songId) ?? SONGS[0];
}
