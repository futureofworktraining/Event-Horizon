"use client";

import { useState, useRef, useEffect, RefObject } from "react";
import { Button } from "@/components/ui/button";

interface VideoPlayerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoUrl: string;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeChange: (time: number) => void;
  onPlayingChange: (playing: boolean) => void;
  initialTime?: number;
  onCapture: () => void;
  isCapturing: boolean;
  onGoToStepTime?: () => void;
  showGoToStepTime?: boolean;
  mode?: "mini" | "expanded";
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isLoading?: boolean;
  onVideoLoaded?: () => void;
}

export function VideoPlayer({
  videoRef,
  canvasRef,
  videoUrl,
  duration,
  currentTime,
  isPlaying,
  onTimeChange,
  onPlayingChange,
  initialTime = 0,
  onCapture,
  isCapturing,
  onGoToStepTime,
  showGoToStepTime = false,
  mode: initialMode = "mini",
  isFullscreen = false,
  onToggleFullscreen,
  isLoading = false,
  onVideoLoaded,
}: VideoPlayerProps) {
  const [mode, setMode] = useState<"mini" | "expanded">(initialMode);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  // Combined loading state: initial load, seeking, or buffering
  const showSpinner = isLoading || isSeeking || isBuffering;

  // Format timestamp
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        onPlayingChange(true);
      } else {
        videoRef.current.pause();
        onPlayingChange(false);
      }
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setIsMuted(newVolume === 0);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      videoRef.current.muted = newMuted;
    }
  };

  // Seek to time
  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      onTimeChange(time);
    }
  };

  // Skip forward/backward
  const skip = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      seekTo(newTime);
    }
  };

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Slider styles
  const sliderClass = `appearance-none cursor-pointer rounded-full
    [&::-webkit-slider-thumb]:appearance-none
    [&::-webkit-slider-thumb]:rounded-full
    [&::-webkit-slider-thumb]:bg-white
    [&::-webkit-slider-thumb]:shadow-md
    [&::-webkit-slider-thumb]:cursor-pointer
    [&::-webkit-slider-thumb]:transition-transform
    [&::-webkit-slider-thumb]:hover:scale-110
    [&::-moz-range-thumb]:rounded-full
    [&::-moz-range-thumb]:bg-white
    [&::-moz-range-thumb]:border-0
    [&::-moz-range-thumb]:cursor-pointer`;

  return (
    <div className={`border rounded-lg overflow-hidden bg-black ${isFullscreen ? "h-full flex flex-col" : ""} ${mode === "expanded" ? "" : "mt-4"}`}>
      {/* Video */}
      <div className={`relative ${isFullscreen ? "flex-1 min-h-0 flex items-center justify-center bg-black" : ""}`}>
        <video
          ref={videoRef}
          src={videoUrl}
          crossOrigin="anonymous"
          muted
          className={`bg-black block cursor-pointer ${
            isFullscreen
              ? "max-w-full max-h-full w-auto h-auto object-contain"
              : mode === "mini"
              ? "w-full max-h-56"
              : "w-full max-h-[60vh]"
          }`}
          style={isFullscreen ? { height: "100%", width: "100%", objectFit: "contain" } : undefined}
          onClick={togglePlayPause}
          onTimeUpdate={(e) => onTimeChange((e.target as HTMLVideoElement).currentTime)}
          onPlay={() => {
            onPlayingChange(true);
            setIsBuffering(false);
          }}
          onPause={() => onPlayingChange(false)}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              if (initialTime > 0) {
                videoRef.current.currentTime = initialTime;
              }
              videoRef.current.volume = volume;
              videoRef.current.muted = true;
            }
          }}
          onCanPlay={() => {
            onVideoLoaded?.();
            setIsBuffering(false);
          }}
          onSeeking={() => setIsSeeking(true)}
          onSeeked={() => setIsSeeking(false)}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => setIsBuffering(false)}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading/Seeking/Buffering spinner overlay */}
        {showSpinner && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
            <div className="flex flex-col items-center gap-3">
              <svg
                className="animate-spin h-12 w-12 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-white text-sm font-medium">
                {isLoading ? "Loading video..." : isSeeking ? "Seeking..." : "Buffering..."}
              </span>
            </div>
          </div>
        )}

        {/* Play overlay on video (expanded mode) - only show when not loading/seeking */}
        {!showSpinner && (mode === "expanded" || isFullscreen) && !isPlaying && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={togglePlayPause}
          >
            <div className={`rounded-full bg-white/90 flex items-center justify-center ${isFullscreen ? "w-20 h-20" : "w-16 h-16"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`text-zinc-900 ml-1 ${isFullscreen ? "w-10 h-10" : "w-8 h-8"}`}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className={`bg-zinc-800 flex-shrink-0 ${mode === "mini" ? "px-3 py-3 space-y-3" : "px-4 py-3 space-y-3"}`}>
        {/* Seek bar */}
        <div className="relative group">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.01}
            value={currentTime}
            onChange={(e) => seekTo(parseFloat(e.target.value))}
            className={`w-full ${mode === "mini" ? "h-2" : "h-2.5"} bg-zinc-600 ${sliderClass}
              [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4`}
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${progress}%, #52525b ${progress}%, #52525b 100%)`
            }}
          />
        </div>

        {/* Time display - centered above controls in expanded mode */}
        {(mode === "expanded" || isFullscreen) && (
          <div className="text-center">
            <span className={`text-zinc-200 font-mono ${isFullscreen ? "text-xl" : "text-lg"}`}>
              {formatTimestamp(currentTime)}
            </span>
            <span className="text-zinc-500 font-mono text-sm mx-2">/</span>
            <span className="text-zinc-400 font-mono text-sm">
              {formatTimestamp(duration)}
            </span>
          </div>
        )}

        {/* Controls row */}
        <div className="flex items-center justify-between gap-2">
          {/* Left controls */}
          <div className="flex items-center gap-1">
            {/* Play/Pause */}
            <button
              onClick={togglePlayPause}
              className="text-white hover:bg-zinc-700 rounded-full transition-colors p-1.5"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={isFullscreen ? "w-7 h-7" : "w-6 h-6"}>
                  <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={isFullscreen ? "w-7 h-7" : "w-6 h-6"}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip buttons (expanded/fullscreen mode) */}
            {(mode === "expanded" || isFullscreen) && (
              <>
                <button
                  onClick={() => skip(-5)}
                  className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
                  title="Back 5s"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M12.5 8.5L8.5 12l4 3.5" />
                    <text x="14" y="14" fontSize="6" fill="currentColor" stroke="none">5</text>
                  </svg>
                </button>
                <button
                  onClick={() => skip(5)}
                  className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
                  title="Forward 5s"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M11.5 8.5l4 3.5-4 3.5" />
                    <text x="5" y="14" fontSize="6" fill="currentColor" stroke="none">5</text>
                  </svg>
                </button>
              </>
            )}

            {/* Volume control */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setShowVolumeSlider(true)}
              onMouseLeave={() => setShowVolumeSlider(false)}
            >
              <button
                onClick={toggleMute}
                className="p-1.5 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-full transition-colors"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.63 3.63a.996.996 0 000 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 101.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29l-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0014 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z"/>
                  </svg>
                ) : volume < 0.5 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M18.5 12A4.5 4.5 0 0016 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>

              {/* Volume slider */}
              {showVolumeSlider && (
                <div className="absolute left-full ml-1 bg-zinc-800 rounded px-2 py-1 z-10">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className={`w-20 h-1.5 bg-zinc-600 ${sliderClass}
                      [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                      [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3`}
                    style={{
                      background: `linear-gradient(to right, #a1a1aa 0%, #a1a1aa ${(isMuted ? 0 : volume) * 100}%, #52525b ${(isMuted ? 0 : volume) * 100}%, #52525b 100%)`
                    }}
                  />
                </div>
              )}
            </div>

            {/* Time display - inline for mini mode only */}
            {mode === "mini" && !isFullscreen && (
              <span className="text-zinc-200 font-mono text-sm ml-2">
                {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
              </span>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* Go to step time button */}
            {showGoToStepTime && onGoToStepTime && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onGoToStepTime}
              >
                Go to step time
              </Button>
            )}

            {/* Capture button */}
            <Button
              size={isFullscreen ? "default" : "sm"}
              onClick={onCapture}
              disabled={isCapturing}
              className="whitespace-nowrap"
            >
              {isCapturing ? "Capturing..." : "Capture Frame"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
