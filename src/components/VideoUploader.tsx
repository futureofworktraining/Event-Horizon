/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime", // MOV
  "video/x-msvideo", // AVI
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface VideoUploaderProps {
  onJobCreated?: (jobId: string) => void;
}

export function VideoUploader({ onJobCreated }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis options state
  const [autoExtractScreenshots, setAutoExtractScreenshots] = useState(true);
  const [autoBoundingBoxes, setAutoBoundingBoxes] = useState(true);
  const [autoSensitiveInfo, setAutoSensitiveInfo] = useState(false);
  const [sensitiveInfoPrompt, setSensitiveInfoPrompt] = useState("");

  const generateUploadUrl = useMutation(api.jobs.generateUploadUrl);
  const createJob = useMutation(api.jobs.createJob);
  const agentAnalyzeVideo = useAction(api.agentAnalyze.agentAnalyzeVideo);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      return `Invalid file type. Accepted formats: MP4, WebM, MOV, AVI`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const validationError = validateFile(droppedFile);
      if (validationError) {
        setError(validationError);
        return;
      }
      setFile(droppedFile);
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        const validationError = validateFile(selectedFile);
        if (validationError) {
          setError(validationError);
          return;
        }
        setFile(selectedFile);
      }
    },
    []
  );

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl();

      // Upload file with progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      const uploadPromise = new Promise<string>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const response = JSON.parse(xhr.responseText);
            resolve(response.storageId);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Upload failed"));
      });

      xhr.open("POST", uploadUrl);
      xhr.send(file);

      const storageId = await uploadPromise;

      // Create job record with analysis options
      const jobId = await createJob({
        videoStorageId: storageId as any,
        fileName: file.name,
        fileSize: file.size,
        autoExtractScreenshots,
        autoBoundingBoxes,
        autoSensitiveInfo,
        sensitiveInfoPrompt: autoSensitiveInfo ? sensitiveInfoPrompt : undefined,
      });

      // Trigger agent analysis (runs in background)
      agentAnalyzeVideo({
        jobId: jobId as any,
        videoStorageId: storageId as any,
      }).catch(console.error);

      // Reset state
      setFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Notify parent
      onJobCreated?.(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }
          ${file ? "cursor-default" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_TYPES.join(",")}
          onChange={handleFileSelect}
          className="hidden"
        />

        {!file ? (
          <div className="space-y-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 mx-auto text-muted-foreground"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            <p className="text-lg font-medium">
              {isDragging ? "Drop video here" : "Drag and drop video file"}
            </p>
            <p className="text-sm text-muted-foreground">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supports MP4, WebM, MOV, AVI (max 100MB)
            </p>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-8 w-8 text-primary"
                  >
                    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
                    <rect x="2" y="6" width="14" height="12" rx="2" />
                  </svg>
                  <div className="text-left">
                    <p className="font-medium truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancel();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {isUploading && (
                <div className="mt-4 space-y-2">
                  <Progress value={uploadProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Analysis Options */}
      {file && !isUploading && (
        <Card className="border-muted">
          <CardContent className="pt-4 space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Post-Processing Options</h4>

            <div className="space-y-3">
              {/* Auto Extract Screenshots */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="autoScreenshots"
                  checked={autoExtractScreenshots}
                  onCheckedChange={(checked) => setAutoExtractScreenshots(checked === true)}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="autoScreenshots" className="text-sm font-medium cursor-pointer">
                    Auto-extract screenshots
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically extract screenshots from video at each step timestamp
                  </p>
                </div>
              </div>

              {/* Auto Bounding Boxes */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="autoBoundingBoxes"
                  checked={autoBoundingBoxes}
                  onCheckedChange={(checked) => setAutoBoundingBoxes(checked === true)}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="autoBoundingBoxes" className="text-sm font-medium cursor-pointer">
                    Auto-detect UI element bounding boxes
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use AI to detect and highlight UI elements in screenshots
                  </p>
                </div>
              </div>

              {/* Auto Sensitive Info Detection */}
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="autoSensitiveInfo"
                  checked={autoSensitiveInfo}
                  onCheckedChange={(checked) => setAutoSensitiveInfo(checked === true)}
                />
                <div className="grid gap-1 leading-none">
                  <Label htmlFor="autoSensitiveInfo" className="text-sm font-medium cursor-pointer">
                    Auto-detect sensitive information
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Use AI to detect and mark sensitive data areas in screenshots
                  </p>
                </div>
              </div>

              {/* Sensitive Info Prompt (shown when checkbox is checked) */}
              {autoSensitiveInfo && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="sensitivePrompt" className="text-sm font-medium">
                    Define sensitive information to detect
                  </Label>
                  <Textarea
                    id="sensitivePrompt"
                    value={sensitiveInfoPrompt}
                    onChange={(e) => setSensitiveInfoPrompt(e.target.value)}
                    placeholder="e.g., SSN (123-45-6789), credit card numbers, passwords, employee IDs, personal phone numbers"
                    className="min-h-[80px] text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Describe what types of sensitive information should be detected and marked
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}

      {/* Upload button */}
      {file && !isUploading && (
        <Button onClick={handleUpload} className="w-full" size="lg">
          Start Analysis
        </Button>
      )}
    </div>
  );
}
