"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoUploader } from "@/components/VideoUploader";
import { JobsList } from "@/components/JobsList";
import { toast } from "sonner";
import { Upload, History } from "lucide-react";

export default function UploadPage() {
  const handleJobCreated = (jobId: string) => {
    toast.success("Video uploaded successfully! Analysis will begin shortly.");
  };

  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Upload Video</h1>
        <p className="text-muted-foreground mt-1">
          Upload a screen recording to automatically generate process documentation
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Upload Section */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-violet-600" />
                Video Upload
              </CardTitle>
              <CardDescription>
                Drag and drop your screen recording or click to browse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader onJobCreated={handleJobCreated} />
            </CardContent>
          </Card>

          {/* Supported Formats */}
          <Card className="mt-6">
            <CardContent className="pt-6">
              <h3 className="font-medium mb-3">Supported Formats</h3>
              <div className="grid grid-cols-2 gap-3">
                {["MP4", "WebM", "MOV", "AVI"].map(format => (
                  <div
                    key={format}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                  >
                    <div className="w-8 h-8 rounded bg-violet-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-violet-600">{format}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">.{format.toLowerCase()}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Maximum file size: 100MB. For best results, use 1080p resolution.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Jobs History */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-violet-600" />
                Recent Analyses
              </CardTitle>
              <CardDescription>
                Track the status of your video analyses
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <JobsList />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
