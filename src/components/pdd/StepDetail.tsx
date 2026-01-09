"use client";

import { useState } from "react";

interface UIElement {
  elementName: string;
  elementType: string;
  locationDescription: string;
  screenRegion: string;
  parentElement?: string;
  identifiers?: {
    id?: string;
    className?: string;
    xpath?: string;
    accessibilityId?: string;
  };
}

interface DataInfo {
  value: string;
  dataType: string;
  source: string;
  isSensitive: boolean;
  format?: string;
  validationRules?: string[];
}

interface WaitCondition {
  waitType: string;
  description: string;
  timeoutSeconds?: number;
  retryCount?: number;
}

interface StepDetailProps {
  uiElement?: UIElement;
  dataInfo?: DataInfo;
  waitCondition?: WaitCondition;
  notes?: string;
  automationHint?: string;
  onUpdateUiElement?: (uiElement: UIElement) => Promise<void>;
}

export function StepDetail({
  uiElement,
  dataInfo,
  waitCondition,
  notes,
  automationHint,
  onUpdateUiElement,
}: StepDetailProps) {
  const [isEditingUi, setIsEditingUi] = useState(false);
  const [editedUiElement, setEditedUiElement] = useState<UIElement | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasContent = uiElement || dataInfo || waitCondition || notes || automationHint;

  if (!hasContent) {
    return null;
  }

  const handleEditUiElement = () => {
    if (uiElement) {
      setEditedUiElement({ ...uiElement });
      setIsEditingUi(true);
    }
  };

  const handleSaveUiElement = async () => {
    if (!editedUiElement || !onUpdateUiElement) return;
    setIsSaving(true);
    try {
      await onUpdateUiElement(editedUiElement);
      setIsEditingUi(false);
      setEditedUiElement(null);
    } catch (error) {
      console.error("Failed to save UI element:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingUi(false);
    setEditedUiElement(null);
  };

  const updateField = (field: keyof UIElement, value: string) => {
    if (editedUiElement) {
      setEditedUiElement({ ...editedUiElement, [field]: value });
    }
  };

  return (
    <div className="mt-3 space-y-3 pl-4 border-l-2 border-muted">
      {/* UI Element Details */}
      {uiElement && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-muted-foreground">UI Element</h4>
            {onUpdateUiElement && !isEditingUi && (
              <button
                onClick={handleEditUiElement}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Edit UI Element"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground">
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
            )}
          </div>

          {isEditingUi && editedUiElement ? (
            <div className="space-y-2 p-2 bg-muted/30 rounded">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Name</label>
                  <input
                    type="text"
                    value={editedUiElement.elementName}
                    onChange={(e) => updateField("elementName", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Type</label>
                  <input
                    type="text"
                    value={editedUiElement.elementType}
                    onChange={(e) => updateField("elementType", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Location</label>
                  <input
                    type="text"
                    value={editedUiElement.locationDescription}
                    onChange={(e) => updateField("locationDescription", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Region</label>
                  <input
                    type="text"
                    value={editedUiElement.screenRegion}
                    onChange={(e) => updateField("screenRegion", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Parent</label>
                  <input
                    type="text"
                    value={editedUiElement.parentElement || ""}
                    onChange={(e) => updateField("parentElement", e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs text-muted-foreground hover:bg-muted rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUiElement}
                  disabled={isSaving}
                  className="px-2 py-1 text-xs text-white bg-primary hover:bg-primary/90 rounded transition-colors flex items-center gap-1"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  <span className="font-medium">{uiElement.elementName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <span>{uiElement.elementType.replace(/_/g, " ")}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Location:</span>{" "}
                  <span>{uiElement.locationDescription}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Region:</span>{" "}
                  <span>{uiElement.screenRegion.replace(/_/g, " ")}</span>
                </div>
                {uiElement.parentElement && (
                  <div>
                    <span className="text-muted-foreground">Parent:</span>{" "}
                    <span>{uiElement.parentElement}</span>
                  </div>
                )}
              </div>
              {uiElement.identifiers && Object.keys(uiElement.identifiers).length > 0 && (
                <div className="mt-2">
                  <span className="text-sm text-muted-foreground">Identifiers:</span>
                  <div className="mt-1 p-2 bg-muted/50 rounded text-xs font-mono">
                    {uiElement.identifiers.id && <div>id: {uiElement.identifiers.id}</div>}
                    {uiElement.identifiers.className && (
                      <div>class: {uiElement.identifiers.className}</div>
                    )}
                    {uiElement.identifiers.xpath && (
                      <div>xpath: {uiElement.identifiers.xpath}</div>
                    )}
                    {uiElement.identifiers.accessibilityId && (
                      <div>a11y: {uiElement.identifiers.accessibilityId}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Data Info */}
      {dataInfo && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">Data</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2">
              <span className="text-muted-foreground">Value:</span>{" "}
              <span className={dataInfo.isSensitive ? "text-orange-600" : ""}>
                {dataInfo.value}
              </span>
              {dataInfo.isSensitive && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">
                  Sensitive
                </span>
              )}
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span>{dataInfo.dataType}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Source:</span>{" "}
              <span>{dataInfo.source.replace(/_/g, " ")}</span>
            </div>
            {dataInfo.format && (
              <div>
                <span className="text-muted-foreground">Format:</span>{" "}
                <span>{dataInfo.format}</span>
              </div>
            )}
          </div>
          {dataInfo.validationRules && dataInfo.validationRules.length > 0 && (
            <div className="mt-1">
              <span className="text-sm text-muted-foreground">Validation:</span>
              <ul className="list-disc list-inside text-sm">
                {dataInfo.validationRules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Wait Condition */}
      {waitCondition && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">Wait Condition</h4>
          <div className="text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span>{waitCondition.waitType.replace(/_/g, " ")}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Description:</span>{" "}
              <span>{waitCondition.description}</span>
            </div>
            {waitCondition.timeoutSeconds && (
              <div>
                <span className="text-muted-foreground">Timeout:</span>{" "}
                <span>{waitCondition.timeoutSeconds}s</span>
              </div>
            )}
            {waitCondition.retryCount && (
              <div>
                <span className="text-muted-foreground">Retries:</span>{" "}
                <span>{waitCondition.retryCount}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
          <p className="text-sm">{notes}</p>
        </div>
      )}

      {/* Automation Hint */}
      {automationHint && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium text-muted-foreground">Automation Hint</h4>
          <p className="text-sm text-blue-600">{automationHint}</p>
        </div>
      )}
    </div>
  );
}
