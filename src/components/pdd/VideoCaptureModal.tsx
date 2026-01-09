"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VideoPlayer } from "./VideoPlayer";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

interface VideoCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  duration: number;
  initialTime?: number;
  onCapture: (storageId: string) => Promise<void>;
}

export function VideoCaptureModal({
  open,
  onOpenChange,
  videoUrl,
  duration,
  initialTime = 0,
  onCapture,
}: VideoCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);

  const generateUploadUrl = useMutation(api.steps.generateUploadUrl);

  // Reset state when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setCurrentTime(initialTime);
      setIsPlaying(false);
      setIsCapturing(false);
      setError(null);
      setIsFullscreen(false);
      setIsVideoLoading(true);
    }
    onOpenChange(newOpen);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleVideoLoaded = () => {
    setIsVideoLoading(false);
  };

  // Capture frame from video
  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Video not loaded");
      return;
    }

    setIsCapturing(true);
    setError(null);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas size to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current frame to canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }
      ctx.drawImage(video, 0, 0);

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to create blob from canvas"));
            }
          },
          "image/jpeg",
          0.9
        );
      });

      // Upload to Convex storage
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });

      if (!response.ok) {
        throw new Error("Failed to upload screenshot");
      }

      const { storageId } = await response.json();

      // Notify parent
      await onCapture(storageId);

      // Close modal
      onOpenChange(false);
    } catch (err) {
      console.error("Capture failed:", err);
      setError(err instanceof Error ? err.message : "Failed to capture frame");
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex flex-col"
        style={{
          width: isFullscreen ? "95vw" : "90vw",
          maxWidth: isFullscreen ? "95vw" : "1200px",
          height: isFullscreen ? "95vh" : "auto",
          maxHeight: isFullscreen ? "95vh" : "90vh",
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Capture Screenshot from Video</DialogTitle>
              <DialogDescription>
                Navigate to the desired frame and click &quot;Capture Frame&quot; to use it as the screenshot.
              </DialogDescription>
            </div>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors mr-6"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              )}
            </button>
          </div>
        </DialogHeader>

        <div className={`w-full ${isFullscreen ? "flex-1 min-h-0 overflow-hidden" : ""}`}>
          <VideoPlayer
            videoRef={videoRef}
            canvasRef={canvasRef}
            videoUrl={videoUrl}
            duration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onTimeChange={setCurrentTime}
            onPlayingChange={setIsPlaying}
            initialTime={initialTime}
            onCapture={handleCapture}
            isCapturing={isCapturing}
            mode="expanded"
            isFullscreen={isFullscreen}
            isLoading={isVideoLoading}
            onVideoLoaded={handleVideoLoaded}
          />
        </div>

        {error && (
          <div className="flex-shrink-0 text-red-600 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
