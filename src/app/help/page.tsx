"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, MessageCircle, ExternalLink, Lightbulb, Zap, Scale, Shield, Cookie, AlertTriangle, Mail } from "lucide-react";
import Link from "next/link";
import { HelpDialog } from "@/components/HelpDialog";

export default function HelpPage() {
  return (
    <div className="p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Help & Support</h1>
        <p className="text-muted-foreground mt-1">
          Get help with Event Horizon AI
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Quick Start Guide */}
        <Card className="hover:border-violet-200 transition-colors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-600" />
              Quick Start
            </CardTitle>
            <CardDescription>
              Get started in minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-600">1</span>
                </div>
                <p>Record your screen while performing a business process</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-600">2</span>
                </div>
                <p>Upload the video file (MP4, WebM, MOV, or AVI)</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-600">3</span>
                </div>
                <p>Wait for AI analysis to complete</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-violet-600">4</span>
                </div>
                <p>Review and export your PDD documentation</p>
              </div>
            </div>
            <Link href="/upload">
              <Button className="w-full">Start Now</Button>
            </Link>
          </CardContent>
        </Card>

        {/* Best Practices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-600" />
              Best Practices
            </CardTitle>
            <CardDescription>
              Tips for better results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-violet-600">•</span>
                Use 1080p or higher resolution
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600">•</span>
                Perform actions at a steady pace
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600">•</span>
                Keep mouse movements deliberate
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600">•</span>
                Ensure UI elements are clearly visible
              </li>
              <li className="flex items-start gap-2">
                <span className="text-violet-600">•</span>
                Avoid multiple browser tabs if possible
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Documentation
            </CardTitle>
            <CardDescription>
              Learn more about features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <HelpDialog>
              <Button variant="outline" className="w-full justify-start gap-2">
                <ExternalLink className="w-4 h-4" />
                User Guide
              </Button>
            </HelpDialog>
            <Button variant="outline" className="w-full justify-start gap-2" disabled>
              <ExternalLink className="w-4 h-4" />
              API Reference
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" disabled>
              <ExternalLink className="w-4 h-4" />
              FAQ
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Terms & Conditions of Use */}
      <div className="mt-10 mb-2">
        <h2 className="text-2xl font-bold tracking-tight">Terms & Conditions of Use</h2>
        <p className="text-muted-foreground mt-1">
          Please review the following terms before using this application.
        </p>
      </div>

      <div className="space-y-6 max-w-4xl">
        {/* Demo Disclaimer */}
        <Card className="border-2 border-amber-300 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Demo Application Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-800">
              This is a <strong>demonstration application</strong> intended for evaluation
              and testing purposes only. It should <strong>not</strong> be used for
              production processes. Do <strong>not</strong> upload or process any personal,
              confidential, sensitive, or otherwise restricted information through this
              application. The AI-generated outputs (Process Design Documents) are provided
              without warranty of accuracy or completeness and should always be reviewed
              by a qualified professional.
            </p>
          </CardContent>
        </Card>

        {/* License & IP */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-violet-600" />
              License & Intellectual Property
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This application and its source code are provided as-is for demonstration
              purposes. All intellectual property rights remain with the author. Unauthorized
              reproduction, distribution, or commercial use is prohibited without explicit
              written consent. The AI-generated outputs are provided without warranty of
              accuracy or completeness.
            </p>
          </CardContent>
        </Card>

        {/* Data Privacy & GDPR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-violet-600" />
              Data Privacy & GDPR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-3">
              <p>By using this application, you acknowledge the following:</p>
              <ul className="list-disc pl-5 space-y-2">
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
          </CardContent>
        </Card>

        {/* Cookies & Local Storage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="w-5 h-5 text-violet-600" />
              Cookies & Local Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This application uses browser local storage to save your preferences and
              session state (such as disclaimer acceptance and UI settings). No tracking
              cookies or third-party analytics cookies are used. Essential storage is required
              for the application to function properly.
            </p>
          </CardContent>
        </Card>

        {/* Limitation of Liability */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Limitation of Liability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              The author and contributors shall not be held liable for any damages, data
              loss, or issues arising from the use of this demo application. The AI-generated
              process documentation may contain errors and should always be reviewed by a
              qualified professional before use in any workflow or process.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contact */}
      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-violet-600" />
            Need More Help?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-4">
            If you have questions or need assistance, our team is here to help.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-violet-600" />
            <a
              href="mailto:futureofworkchannel@gmail.com"
              className="text-sm text-violet-600 hover:text-violet-700 font-medium underline"
            >
              futureofworkchannel@gmail.com
            </a>
          </div>
          <Button variant="outline" asChild>
            <a href="mailto:futureofworkchannel@gmail.com">Contact Support</a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
