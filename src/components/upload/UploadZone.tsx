import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface Props {
  onUpload: (base64: string) => void;
}

export default function UploadZone({ onUpload }: Props) {
  const onDrop = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`flex h-64 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
        isDragActive
          ? "border-violet-500 bg-violet-500/10"
          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-500"
      }`}
    >
      <input {...getInputProps()} />
      <svg
        className="mb-3 h-10 w-10 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
        />
      </svg>
      <p className="text-sm text-zinc-400">
        {isDragActive
          ? "Drop your screenshot here"
          : "Drag & drop a UI screenshot, or click to browse"}
      </p>
      <p className="mt-1 text-xs text-zinc-600">PNG, JPG, WebP</p>
    </div>
  );
}
