/**
 * KubekOS Media Player Application
 * Supports Web Audio API procedural ambient synth tracks AND local audio file import
 * (.mp3, .wav, .ogg), playlist management, playback controls, and volume control.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
} from 'lucide-react';
import { useKernelStore } from '@/kernel/kernelStore';
import { ACCENT_COLORS } from '@/theme/tokens';

interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  type: 'SYNTH' | 'FILE';
  synthFreqs?: number[];
  audioUrl?: string;
}

const DEFAULT_PLAYLIST: AudioTrack[] = [
  {
    id: 'track-nebula',
    title: 'Nebula Ambient Pad (WebAudio Synth)',
    artist: 'KubekOS Sound Engine',
    type: 'SYNTH',
    synthFreqs: [220, 277.18, 329.63, 440],
  },
  {
    id: 'track-aurora',
    title: 'Aurora Harmonic Pulse (WebAudio Synth)',
    artist: 'KubekOS Sound Engine',
    type: 'SYNTH',
    synthFreqs: [196, 246.94, 293.66, 392],
  },
  {
    id: 'track-cyber',
    title: 'Obsidian Horizon (WebAudio Synth)',
    artist: 'KubekOS Sound Engine',
    type: 'SYNTH',
    synthFreqs: [164.81, 220, 261.63, 329.63],
  },
];

export const MediaPlayerApp: React.FC = () => {
  const preferences = useKernelStore((s) => s.preferences);
  const updatePreferences = useKernelStore((s) => s.updatePreferences);
  const accent = ACCENT_COLORS[preferences.accentColor] ?? ACCENT_COLORS.cyan;

  const [playlist, setPlaylist] = useState<AudioTrack[]>(DEFAULT_PLAYLIST);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTrack = playlist[currentIndex] ?? playlist[0]!;

  const stopAllAudio = () => {
    if (audioElRef.current) {
      audioElRef.current.pause();
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  const startPlayback = (track: AudioTrack) => {
    stopAllAudio();

    if (track.type === 'FILE' && track.audioUrl) {
      const audio = new Audio(track.audioUrl);
      audio.volume = preferences.soundVolume / 100;
      audio.onended = () => setIsPlaying(false);
      audioElRef.current = audio;
      void audio.play();
      setIsPlaying(true);
      return;
    }

    // Web Audio API Ambient Chord Synth
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const masterGain = ctx.createGain();
      masterGain.gain.value = (preferences.soundVolume / 100) * 0.12;
      masterGain.connect(ctx.destination);

      const freqs = track.synthFreqs ?? [220, 330, 440];
      for (const f of freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        osc.connect(masterGain);
        osc.start();
      }
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAllAudio();
      setIsPlaying(false);
    } else {
      startPlayback(currentTrack);
    }
  };

  const selectTrack = (idx: number) => {
    setCurrentIndex(idx);
    const nextTrack = playlist[idx];
    if (nextTrack) {
      startPlayback(nextTrack);
    }
  };

  const handleImportAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: AudioTrack[] = Array.from(files).map((file) => ({
      id: `local_${Date.now()}_${file.name}`,
      title: file.name,
      artist: 'Imported Local Audio',
      type: 'FILE',
      audioUrl: URL.createObjectURL(file),
    }));

    setPlaylist((prev) => [...prev, ...newTracks]);
    e.target.value = '';
  };

  return (
    <div data-testid="app-media-player" className="h-full flex flex-col p-5 gap-4 text-xs select-none">
      {/* Now Playing Card */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex items-center gap-5">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center ${accent.subtleBgClass} ${accent.textClass} border ${accent.borderClass}`}
        >
          <Music className={`w-8 h-8 ${isPlaying ? 'animate-pulse' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase text-cyan-400">
            {isPlaying ? 'Now Playing' : 'Paused'}
          </div>
          <div className="text-base font-semibold text-white truncate">
            {currentTrack.title}
          </div>
          <div className="text-slate-400 truncate">{currentTrack.artist}</div>
        </div>
      </div>

      {/* Transport Controls & Volume */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/70 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => selectTrack((currentIndex - 1 + playlist.length) % playlist.length)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="media-play-toggle"
            onClick={togglePlay}
            className={`p-3 rounded-xl ${accent.bgClass} text-slate-950 cursor-pointer`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => selectTrack((currentIndex + 1) % playlist.length)}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-200 cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-44">
          <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            value={preferences.soundVolume}
            onChange={(e) => updatePreferences({ soundVolume: Number(e.target.value) })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
          <span className="font-mono text-[11px] text-slate-400 w-8 text-right">
            {preferences.soundVolume}%
          </span>
        </div>
      </div>

      {/* Playlist Header & Local File Import */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-white">
            Playlist ({playlist.length} tracks)
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import Audio File</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleImportAudioFile}
            className="hidden"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {playlist.map((track, idx) => {
            const active = idx === currentIndex;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => selectTrack(idx)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  active
                    ? `${accent.subtleBgClass} ${accent.borderClass} text-white`
                    : 'bg-slate-900/50 border-slate-800/70 text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <div>
                  <div className="font-medium">{track.title}</div>
                  <div className="text-[10px] text-slate-400">{track.artist}</div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400">
                  {track.type}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
