"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ProcessingStatusProps {
  status: string;
  progress?: number;
  errorMessage?: string;
}

export function ProcessingStatus({ status, progress, errorMessage }: ProcessingStatusProps) {
  if (status === "failed") {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-destructive"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" x2="9" y1="9" y2="15" />
              <line x1="9" x2="15" y1="9" y2="15" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-destructive">Analysis Failed</h3>
              <p className="text-sm text-muted-foreground">
                {errorMessage || "An error occurred during video analysis"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center gap-6 py-8">
          {/* Animated loading spinner */}
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-16 w-16 text-primary animate-spin"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">
              {status === "pending" ? "Preparing Analysis..." : "Analyzing Video..."}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {status === "pending"
                ? "Your video is being prepared for analysis."
                : "AI is analyzing the screen recording to extract process steps. This may take a few minutes."}
            </p>
          </div>

          {progress !== undefined && progress >= 0 && (
            <div className="w-full max-w-md space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {progress}% complete
              </p>
              <p className="text-xs text-center text-muted-foreground">
                {progress <= 10 && "Downloading video..."}
                {progress > 10 && progress <= 20 && "Video downloaded, preparing..."}
                {progress > 20 && progress <= 35 && "Uploading video to Gemini..."}
                {progress > 35 && progress <= 45 && "Processing video in Gemini..."}
                {progress > 45 && progress <= 60 && "AI is analyzing screen recording (this may take a few minutes)..."}
                {progress > 60 && progress <= 65 && "Parsing AI response..."}
                {progress > 65 && progress <= 90 && "Creating processes and steps..."}
                {progress > 90 && progress < 100 && "Finalizing..."}
              </p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {status === "pending" && "Status: Pending"}
            {status === "processing" && "Status: Processing"}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
