"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Shield, Cookie, Mail, Scale } from "lucide-react";

const DISCLAIMER_ACCEPTED_KEY = "event-horizon-disclaimer-accepted";

export function DisclaimerModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(DISCLAIMER_ACCEPTED_KEY);
    if (!accepted) {
      setOpen(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(DISCLAIMER_ACCEPTED_KEY, new Date().toISOString());
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-lg max-h-[90vh]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Scale className="w-6 h-6 text-violet-600" />
            Terms of Use & Legal Notice
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-5 text-sm text-muted-foreground">
            {/* Demo Disclaimer */}
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-1">Demo Application Notice</h3>
                  <p className="text-amber-700">
                    This is a <strong>demonstration application</strong> intended for evaluation
                    and testing purposes only. It should <strong>not</strong> be used for
                    production processes. Do <strong>not</strong> upload or process any personal,
                    confidential, sensitive, or otherwise restricted information through this
                    application.
                  </p>
                </div>
              </div>
            </div>

            {/* License */}
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1.5">
                <Scale className="w-4 h-4 text-violet-600" />
                License & Intellectual Property
              </h3>
              <p>
                This application and its source code are provided as-is for demonstration
                purposes. All intellectual property rights remain with the author. Unauthorized
                reproduction, distribution, or commercial use is prohibited without explicit
                written consent. The AI-generated outputs (Process Design Documents) are provided
                without warranty of accuracy or completeness.
              </p>
            </div>

            {/* Data Privacy & GDPR */}
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1.5">
                <Shield className="w-4 h-4 text-violet-600" />
                Data Privacy & GDPR
              </h3>
              <p>
                By using this application, you acknowledge the following:
              </p>
              <ul className="list-disc pl-5 mt-1.5 space-y-1">
                <li>
                  Uploaded videos are processed by third-party AI services (Google Gemini) and
                  may be temporarily stored on external servers.
                </li>
                <li>
                  Video data and extracted process information are stored in a cloud database
                  (Convex) for the duration of your usage.
                </li>
                <li>
                  No personal data is intentionally collected. However, any personal data
                  visible in uploaded screen recordings will be processed by the AI.
                </li>
                <li>
                  You are solely responsible for ensuring that any data you upload complies
                  with applicable data protection regulations, including GDPR.
                </li>
                <li>
                  You must not upload videos containing personal data of third parties without
                  their explicit consent.
                </li>
              </ul>
            </div>

            {/* Cookies & Local Storage */}
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1.5">
                <Cookie className="w-4 h-4 text-violet-600" />
                Cookies & Local Storage
              </h3>
              <p>
                This application uses browser local storage to save your preferences and
                session state (such as this disclaimer acceptance). No tracking cookies or
                third-party analytics cookies are used. Essential storage is required for the
                application to function properly.
              </p>
            </div>

            {/* Limitation of Liability */}
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1.5">
                Limitation of Liability
              </h3>
              <p>
                The author and contributors shall not be held liable for any damages, data
                loss, or issues arising from the use of this demo application. The AI-generated
                process documentation may contain errors and should always be reviewed by a
                qualified professional before use in any workflow or process.
              </p>
            </div>

            {/* Contact */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2 mb-1.5">
                <Mail className="w-4 h-4 text-violet-600" />
                Questions?
              </h3>
              <p>
                If you have any questions about these terms, data privacy, or the application
                itself, please contact us at:{" "}
                <a
                  href="mailto:futureofworkchannel@gmail.com"
                  className="text-violet-600 hover:text-violet-700 font-medium underline"
                >
                  futureofworkchannel@gmail.com
                </a>
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleAccept} className="w-full sm:w-auto">
            I Understand & Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
