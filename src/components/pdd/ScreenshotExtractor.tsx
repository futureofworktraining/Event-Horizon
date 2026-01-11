"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractFramesFromVideo } from "@/lib/videoFrameExtractor";

interface ScreenshotExtractorProps {
  processId: Id<"processes">;
  videoStorageId: Id<"_storage">;
}

export function ScreenshotExtractor({ processId, videoStorageId }: ScreenshotExtractorProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const stepsNeedingScreenshots = useQuery(api.jobs.getStepsNeedingScreenshots, { processId });
  const videoUrl = useQuery(api.jobs.getVideoUrl, { storageId: videoStorageId });
  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const updateStepScreenshot = useMutation(api.jobs.updateStepScreenshot);

  const handleExtract = async () => {
    if (!stepsNeedingScreenshots || stepsNeedingScreenshots.length === 0 || !videoUrl || isExtracting) {
      return;
    }

    setIsExtracting(true);
    setError(null);
    setProgress({ current: 0, total: stepsNeedingScreenshots.length });

    try {
      // Extract frames from video
      const frames = await extractFramesFromVideo(
        videoUrl,
        stepsNeedingScreenshots,
        (current, total) => {
          setProgress({ current, total });
        }
      );

      // Upload each frame and update the step
      for (const frame of frames) {
        if (frame.blob) {
          try {
            // Get upload URL
            const uploadUrl = await generateUploadUrl();

            // Upload the frame
            const response = await fetch(uploadUrl, {
              method: "POST",
              headers: { "Content-Type": "image/png" },
              body: frame.blob,
            });

            if (response.ok) {
              const { storageId } = await response.json();

              // Find the step ID
              const step = stepsNeedingScreenshots.find(
                (s) => s.stepNumber === frame.stepNumber
              );

              if (step) {
                await updateStepScreenshot({
                  stepId: step._id,
                  screenshotStorageId: storageId,
                });
              }
            }
          } catch (uploadError) {
            console.error(`Failed to upload frame for step ${frame.stepNumber}:`, uploadError);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to extract frames");
    } finally {
      setIsExtracting(false);
    }
  };

  // Loading state
  if (stepsNeedingScreenshots === undefined) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-6">
          <div className="flex items-center space-x-4">
            <div className="h-12 w-12 bg-amber-200 rounded-full animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-amber-200 rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-amber-200 rounded w-1/2 animate-pulse" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't show if there are no steps needing screenshots
  if (stepsNeedingScreenshots.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-amber-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          Screenshots Missing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-amber-700 mb-3">
          {stepsNeedingScreenshots.length === 0
            ? "No steps require screenshots to be extracted."
            : `${stepsNeedingScreenshots.length} step(s) are missing screenshots. Extract them from the video?`
          }
        </p>

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {isExtracting ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-amber-700">
              <span>Extracting frames...</span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="w-full bg-amber-200 rounded-full h-2">
              <div
                className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: progress.total > 0
                    ? `${(progress.current / progress.total) * 100}%`
                    : "0%",
                }}
              />
            </div>
          </div>
        ) : (
          <Button
            onClick={handleExtract}
            variant="outline"
            disabled={!stepsNeedingScreenshots || stepsNeedingScreenshots.length === 0}
            className="border-amber-300 hover:bg-amber-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 mr-2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Extract Screenshots
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
