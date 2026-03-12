import { useState, useCallback } from "react";
import UploadZone from "./components/upload/UploadZone";
import BoundingBoxEditor from "./components/editor/BoundingBoxEditor";
import DraggablePreview from "./components/preview/DraggablePreview";
import CodePreview from "./components/preview/CodePreview";
import ChatPanel from "./components/chat/ChatPanel";
import ApiKeyInput from "./components/settings/ApiKeyInput";
import { useApiKey } from "./hooks/useApiKey";
import { useBoundingBoxes } from "./hooks/useBoundingBoxes";
import { useDetection } from "./hooks/useDetection";
import { useCodeGeneration } from "./hooks/useCodeGeneration";
import type { LayoutChange } from "./types";

export default function App() {
  const { apiKey, setApiKey, hasKey } = useApiKey();
  const {
    boxes,
    selectedId,
    selected,
    setSelectedId,
    setAll,
    addBox,
    updateBox,
    removeBox,
  } = useBoundingBoxes();
  const { detect, loading: detecting, error: detectError, imageId, fullText } = useDetection();
  const {
    code,
    chatMessages,
    loading: generating,
    error: genError,
    generate,
    iterate,
    reset,
  } = useCodeGeneration(apiKey);

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutChanges, setLayoutChanges] = useState<LayoutChange[]>([]);
  const [showCode, setShowCode] = useState(false);

  const handleUpload = useCallback(
    async (base64: string) => {
      setImageUrl(base64);
      reset();
      setLayoutChanges([]);

      const img = new Image();
      img.onload = async () => {
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
        const detectedBoxes = await detect(base64);
        setAll(detectedBoxes);
      };
      img.src = base64;
    },
    [detect, setAll, reset]
  );

  const handleGenerate = useCallback(() => {
    if (boxes.length === 0) return;
    generate(boxes, imageSize.width, imageSize.height, fullText);
  }, [boxes, imageSize, generate, fullText]);

  const handleRegenerate = useCallback(() => {
    if (boxes.length === 0) return;
    reset();
    setLayoutChanges([]);
    generate(boxes, imageSize.width, imageSize.height, fullText);
  }, [boxes, imageSize, generate, fullText, reset]);

  const handleBackToEditor = useCallback(() => {
    reset();
    setLayoutChanges([]);
  }, [reset]);

  const handleIterate = useCallback(
    (feedback: string) => {
      iterate(feedback, layoutChanges);
      setLayoutChanges([]);
    },
    [iterate, layoutChanges]
  );

  const handleLayoutChange = useCallback((changes: LayoutChange[]) => {
    setLayoutChanges(changes);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight">Reactor</h1>
          <span className="rounded bg-violet-600/20 px-2 py-0.5 text-xs text-violet-400">
            UI → Code
          </span>
        </div>
        <div className="flex items-center gap-3">
          {code && (
            <button
              onClick={() => setShowCode(!showCode)}
              className={`rounded px-3 py-1.5 text-sm ${
                showCode
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {showCode ? "Visual" : "Code"}
            </button>
          )}
          {imageUrl && (
            <button
              onClick={() => {
                setImageUrl(null);
                setAll([]);
                reset();
                setLayoutChanges([]);
              }}
              className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700"
            >
              New Upload
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-700"
          >
            {hasKey ? "API Key ✓" : "Set API Key"}
          </button>
        </div>
      </header>

      {/* API Key Banner */}
      {settingsOpen && (
        <div className="border-b border-zinc-800 bg-zinc-900 px-6 py-3">
          <div className="mx-auto max-w-md">
            <ApiKeyInput
              apiKey={apiKey}
              onSave={(k) => {
                setApiKey(k);
                setSettingsOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {!imageUrl ? (
          /* Upload Stage */
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="w-full max-w-lg">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold">Upload a UI Screenshot</h2>
                <p className="mt-2 text-sm text-zinc-400">
                  We'll detect UI elements and generate React + Tailwind code
                </p>
              </div>
              <UploadZone onUpload={handleUpload} />
              {!hasKey && (
                <p className="mt-4 text-center text-xs text-amber-400">
                  Set your Anthropic API key before generating code
                </p>
              )}
            </div>
          </div>
        ) : !code ? (
          /* Editor Stage */
          <div className="flex flex-1 flex-col overflow-auto p-6">
            <div className="mx-auto w-full max-w-4xl">
              {detecting && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-violet-600/10 px-4 py-3 text-sm text-violet-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                  Detecting UI elements...
                </div>
              )}
              {detectError && (
                <div className="mb-4 rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {detectError}
                </div>
              )}
              <BoundingBoxEditor
                imageUrl={imageUrl}
                imageId={imageId}
                boxes={boxes}
                selectedId={selectedId}
                onSelectBox={setSelectedId}
                onUpdateBox={updateBox}
                onRemoveBox={removeBox}
                onAddBox={addBox}
                selected={selected}
                imageSize={imageSize}
              />
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-zinc-500">
                  {boxes.length} element{boxes.length !== 1 ? "s" : ""} detected
                </span>
                <button
                  onClick={handleGenerate}
                  disabled={!hasKey || boxes.length === 0 || generating}
                  className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate Code"}
                </button>
              </div>
              {genError && (
                <div className="mt-3 rounded-lg bg-red-900/20 px-4 py-3 text-sm text-red-300">
                  {genError}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Preview + Chat Stage */
          <div className="flex flex-1 overflow-hidden">
            {/* Preview area */}
            <div className="flex flex-1 flex-col overflow-hidden p-4">
              {showCode ? (
                <CodePreview code={code} />
              ) : (
                <div className="flex h-full flex-col">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      Drag elements to rearrange, then send feedback
                    </span>
                    {layoutChanges.length > 0 && (
                      <span className="rounded bg-violet-600/20 px-2 py-0.5 text-xs text-violet-400">
                        {layoutChanges.length} move
                        {layoutChanges.length !== 1 ? "s" : ""} pending
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <DraggablePreview
                      code={code}
                      onLayoutChange={handleLayoutChange}
                    />
                  </div>
                </div>
              )}
            </div>
            {/* Chat sidebar */}
            <div className="w-80 border-l border-zinc-800 p-4">
              <ChatPanel
                messages={chatMessages}
                loading={generating}
                onSend={handleIterate}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
