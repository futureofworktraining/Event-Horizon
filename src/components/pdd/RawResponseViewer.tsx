/* eslint-disable @typescript-eslint/no-explicit-any , react-hooks/preserve-manual-memoization */
"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Code, Copy, Check, X, ChevronRight, ChevronDown } from "lucide-react";

interface RawResponseViewerProps {
  jobId: Id<"jobs">;
}

interface JsonNodeProps {
  data: any;
  keyName?: string;
  depth?: number;
  defaultExpanded?: boolean;
}

function JsonNode({ data, keyName, depth = 0, defaultExpanded = true }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const indent = depth * 16;

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Primitive values
  if (data === null) {
    return (
      <div style={{ marginLeft: indent }} className="py-0.5">
        {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
        {keyName && <span className="text-gray-500">: </span>}
        <span className="text-gray-400">null</span>
      </div>
    );
  }

  if (typeof data === "boolean") {
    return (
      <div style={{ marginLeft: indent }} className="py-0.5">
        {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
        {keyName && <span className="text-gray-500">: </span>}
        <span className="text-blue-600">{data.toString()}</span>
      </div>
    );
  }

  if (typeof data === "number") {
    return (
      <div style={{ marginLeft: indent }} className="py-0.5">
        {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
        {keyName && <span className="text-gray-500">: </span>}
        <span className="text-orange-600">{data}</span>
      </div>
    );
  }

  if (typeof data === "string") {
    return (
      <div style={{ marginLeft: indent }} className="py-0.5">
        {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
        {keyName && <span className="text-gray-500">: </span>}
        <span className="text-green-600">&quot;{data}&quot;</span>
      </div>
    );
  }

  // Arrays
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ marginLeft: indent }} className="py-0.5">
          {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
          {keyName && <span className="text-gray-500">: </span>}
          <span className="text-gray-500">[]</span>
        </div>
      );
    }

    return (
      <div style={{ marginLeft: indent }}>
        <div
          className="py-0.5 cursor-pointer hover:bg-gray-100 rounded flex items-center gap-1"
          onClick={toggleExpand}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
          {keyName && <span className="text-gray-500">: </span>}
          <span className="text-gray-500">[</span>
          {!isExpanded && (
            <span className="text-gray-400 text-xs ml-1">{data.length} items</span>
          )}
          {!isExpanded && <span className="text-gray-500">]</span>}
        </div>
        {isExpanded && (
          <>
            {data.map((item, index) => (
              <JsonNode
                key={index}
                data={item}
                depth={depth + 1}
                defaultExpanded={true}
              />
            ))}
            <div style={{ marginLeft: indent }} className="text-gray-500">]</div>
          </>
        )}
      </div>
    );
  }

  // Objects
  if (typeof data === "object") {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return (
        <div style={{ marginLeft: indent }} className="py-0.5">
          {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
          {keyName && <span className="text-gray-500">: </span>}
          <span className="text-gray-500">{"{}"}</span>
        </div>
      );
    }

    return (
      <div style={{ marginLeft: indent }}>
        <div
          className="py-0.5 cursor-pointer hover:bg-gray-100 rounded flex items-center gap-1"
          onClick={toggleExpand}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
          {keyName && <span className="text-purple-700">&quot;{keyName}&quot;</span>}
          {keyName && <span className="text-gray-500">: </span>}
          <span className="text-gray-500">{"{"}</span>
          {!isExpanded && (
            <span className="text-gray-400 text-xs ml-1">{keys.length} keys</span>
          )}
          {!isExpanded && <span className="text-gray-500">{"}"}</span>}
        </div>
        {isExpanded && (
          <>
            {keys.map((key) => (
              <JsonNode
                key={key}
                data={data[key]}
                keyName={key}
                depth={depth + 1}
                defaultExpanded={true}
              />
            ))}
            <div style={{ marginLeft: indent }} className="text-gray-500">{"}"}</div>
          </>
        )}
      </div>
    );
  }

  return null;
}

export function RawResponseViewer({ jobId }: RawResponseViewerProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const job = useQuery(api.jobs.getJob, { jobId });

  // Loading state
  const isLoading = job === undefined;

  const { parsedResponse, beautifiedJson } = useMemo(() => {
    if (!job?.rawAiResponse) {
      return { parsedResponse: null, beautifiedJson: "" };
    }
    try {
      const parsed = JSON.parse(job.rawAiResponse);
      return {
        parsedResponse: parsed,
        beautifiedJson: JSON.stringify(parsed, null, 2),
      };
    } catch {
      return { parsedResponse: null, beautifiedJson: job.rawAiResponse };
    }
  }, [job?.rawAiResponse]);

  const hasResponse = !!job?.rawAiResponse;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(beautifiedJson || job?.rawAiResponse || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    if (!parsedResponse?.processes) return null;
    return {
      processes: parsedResponse.processes.length || 0,
      steps: parsedResponse.processes.reduce((sum: number, p: any) => sum + (p.steps?.length || 0), 0) || 0,
      nodes: parsedResponse.processes.reduce((sum: number, p: any) => sum + (p.flow?.nodes?.length || 0), 0) || 0,
      edges: parsedResponse.processes.reduce((sum: number, p: any) => sum + (p.flow?.edges?.length || 0), 0) || 0,
    };
  }, [parsedResponse]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Code className="w-4 h-4" />
          Raw AI Response
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="!max-w-[90vw] !w-[90vw] !max-h-[90vh] !h-[90vh] flex flex-col p-0 overflow-hidden"
      >
        {/* Header - Light theme */}
        <DialogHeader className="px-4 py-3 border-b bg-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm font-medium text-gray-700">
              Raw Gemini Response
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Summary stats - compact */}
              {stats && (
                <div className="flex items-center gap-3 text-xs text-gray-500 mr-4">
                  <span>{stats.processes} processes</span>
                  <span className="text-gray-300">|</span>
                  <span>{stats.steps} steps</span>
                  <span className="text-gray-300">|</span>
                  <span>{stats.nodes} nodes</span>
                  <span className="text-gray-300">|</span>
                  <span>{stats.edges} edges</span>
                </div>
              )}
              {!isLoading && hasResponse && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-7 text-xs gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content - Light theme */}
        <div className="flex-1 overflow-auto bg-white">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-gray-500 rounded-full mx-auto mb-3" />
                <p className="text-sm">Loading...</p>
              </div>
            </div>
          ) : !hasResponse ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Code className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">No raw AI response data</p>
                <p className="text-xs mt-1 text-gray-400">
                  This analysis was done before this feature was added.
                </p>
              </div>
            </div>
          ) : parsedResponse ? (
            <div className="font-mono text-xs p-4">
              <JsonNode data={parsedResponse} defaultExpanded={true} />
            </div>
          ) : (
            <pre className="font-mono text-xs p-4 text-gray-700 whitespace-pre-wrap">
              {beautifiedJson}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
