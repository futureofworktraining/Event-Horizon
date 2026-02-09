"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Video, Upload, BrainCircuit, Mail } from "lucide-react";

interface HelpDialogProps {
  children?: React.ReactNode;
}

export function HelpDialog({ children }: HelpDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" title="How to use">
            <Info className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            How to use Video to PDD
          </DialogTitle>
          <DialogDescription className="text-base">
            Turn your screen recordings into professional Process Design Documents in three simple steps.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6">
          {/* Step 1 */}
          <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Video className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg">1. Record Process</h3>
            <p className="text-sm text-muted-foreground">
              Record your screen while performing the business process you want to document.
            </p>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg">2. Upload Video</h3>
            <p className="text-sm text-muted-foreground">
              Upload your recording to the platform using the simple drag-and-drop interface.
            </p>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h3 className="font-semibold text-lg">3. AI Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Our AI analyzes the video to generate a detailed flow, steps, and PDD document automatically.
            </p>
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
              <Mail className="w-4 h-4" /> Need Help or Support?
            </h4>
            <p className="text-sm">
              Contact us at{" "}
              <a
                href="mailto:futureofworkchannel@gmail.com"
                className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                futureofworkchannel@gmail.com
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
