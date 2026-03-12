interface Props {
  code: string;
}

export default function CodePreview({ code }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-zinc-700">
      <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-3 py-1.5">
        <span className="text-xs font-medium text-zinc-400">
          Generated Code
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="rounded px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
        >
          Copy
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-zinc-900">
        <pre className="p-4 text-sm leading-relaxed">
          <code className="text-zinc-300">{code}</code>
        </pre>
      </div>
    </div>
  );
}
