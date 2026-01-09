"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Application {
  name: string;
  type: string;
  url?: string;
  version?: string;
}

interface ApplicationsListProps {
  applications: Application[];
}

const typeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  web_application: {
    label: "Web",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  desktop_application: {
    label: "Desktop",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
  },
  mobile_application: {
    label: "Mobile",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
  terminal: {
    label: "Terminal",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  },
  other: {
    label: "Other",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
};

export function ApplicationsList({ applications }: ApplicationsListProps) {
  if (!applications || applications.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Applications Used</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {applications.map((app, index) => {
            const config = typeConfig[app.type] || typeConfig.other;
            return (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card"
              >
                <span className="font-medium">{app.name}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${config.color} ${config.bgColor}`}
                >
                  {config.label}
                </span>
                {app.url && (() => {
                  try {
                    const url = new URL(app.url);
                    return (
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        {url.hostname}
                      </a>
                    );
                  } catch {
                    return (
                      <span className="text-xs text-muted-foreground">
                        {app.url}
                      </span>
                    );
                  }
                })()}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
