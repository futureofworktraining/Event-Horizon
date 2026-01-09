"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, BookOpen, MessageCircle, ExternalLink, Lightbulb, Zap } from "lucide-react";
import Link from "next/link";

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
            <Button variant="outline" className="w-full justify-start gap-2" disabled>
              <ExternalLink className="w-4 h-4" />
              User Guide
            </Button>
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
          <Button variant="outline" disabled>
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
