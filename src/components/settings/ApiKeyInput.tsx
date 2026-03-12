import { useState } from "react";

interface Props {
  apiKey: string;
  onSave: (key: string) => void;
}

export default function ApiKeyInput({ apiKey, onSave }: Props) {
  const [value, setValue] = useState(apiKey);
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="sk-ant-..."
        className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-violet-500 focus:outline-none"
      />
      <button
        onClick={() => setVisible(!visible)}
        className="rounded bg-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-600"
      >
        {visible ? "Hide" : "Show"}
      </button>
      <button
        onClick={() => onSave(value)}
        className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
      >
        Save
      </button>
    </div>
  );
}
