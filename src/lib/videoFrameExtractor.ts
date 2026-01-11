/**
 * Client-side video frame extraction utility
 * Extracts frames from a video at specified timestamps using canvas
 */

export interface FrameExtractionResult {
  stepNumber: number;
  timestamp: string;
  timestampSeconds: number;
  blob: Blob | null;
  error?: string;
}

/**
 * Load a video element and wait for it to be ready
 */
function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";

    video.onloadedmetadata = () => {
      resolve(video);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video"));
    };

    video.src = url;
  });
}

/**
 * Seek video to a specific time and wait for it to be ready
 */
function seekToTime(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clamp time to video duration
    const seekTime = Math.min(Math.max(0, timeSeconds), video.duration - 0.1);

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      // Small delay to ensure frame is rendered
      setTimeout(resolve, 50);
    };

    const onError = () => {
      video.removeEventListener("error", onError);
      reject(new Error(`Failed to seek to ${timeSeconds}s`));
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = seekTime;
  });
}

/**
 * Capture a frame from the video as a JPEG blob
 */
function captureFrame(video: HTMLVideoElement, quality: number = 0.85): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => resolve(blob),
      "image/png"
    );
  });
}

/**
 * Extract frames from a video at specified timestamps
 */
export async function extractFramesFromVideo(
  videoUrl: string,
  steps: Array<{ stepNumber: number; timestamp: string; timestampSeconds: number }>,
  onProgress?: (current: number, total: number) => void
): Promise<FrameExtractionResult[]> {
  const results: FrameExtractionResult[] = [];

  try {
    const video = await loadVideo(videoUrl);
    const total = steps.length;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      try {
        await seekToTime(video, step.timestampSeconds);
        const blob = await captureFrame(video);

        results.push({
          stepNumber: step.stepNumber,
          timestamp: step.timestamp,
          timestampSeconds: step.timestampSeconds,
          blob,
        });
      } catch (error) {
        results.push({
          stepNumber: step.stepNumber,
          timestamp: step.timestamp,
          timestampSeconds: step.timestampSeconds,
          blob: null,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    // Clean up
    video.src = "";
    video.load();

  } catch (error) {
    // If video loading fails, return empty results for all steps
    for (const step of steps) {
      results.push({
        stepNumber: step.stepNumber,
        timestamp: step.timestamp,
        timestampSeconds: step.timestampSeconds,
        blob: null,
        error: error instanceof Error ? error.message : "Failed to load video",
      });
    }
  }

  return results;
}

// Cache for video element to avoid reloading for multiple extractions
let cachedVideo: HTMLVideoElement | null = null;
let cachedVideoUrl: string | null = null;

/**
 * Extract a single frame from a video at a specific timestamp
 * Caches the video element for efficiency when extracting multiple frames
 */
export async function extractSingleFrame(
  videoUrl: string,
  timestampSeconds: number
): Promise<Blob | null> {
  try {
    // Reuse cached video if same URL
    if (cachedVideo && cachedVideoUrl === videoUrl) {
      await seekToTime(cachedVideo, timestampSeconds);
      return await captureFrame(cachedVideo);
    }

    // Load new video
    cachedVideo = await loadVideo(videoUrl);
    cachedVideoUrl = videoUrl;

    await seekToTime(cachedVideo, timestampSeconds);
    return await captureFrame(cachedVideo);
  } catch (error) {
    console.error("Failed to extract single frame:", error);
    return null;
  }
}

/**
 * Clear the cached video element
 * Call this when done with frame extraction to free memory
 */
export function clearVideoCache() {
  if (cachedVideo) {
    cachedVideo.src = "";
    cachedVideo.load();
    cachedVideo = null;
    cachedVideoUrl = null;
  }
}
