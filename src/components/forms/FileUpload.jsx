import { useRef, useState } from "react";
import { FiUploadCloud, FiCheckCircle, FiImage } from "react-icons/fi";

export default function FileUpload({ onFileSelect, accept = "image/*", label = "Upload proof of payment" }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    setPreview(URL.createObjectURL(file));
    onFileSelect?.(file);
  };

  return (
    <div>
      <label className="field-label">{label}</label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-line hover:border-nude-400 bg-nude-50/50 flex flex-col items-center justify-center gap-2 py-8 transition-colors"
      >
        {preview ? (
          <>
            <img src={preview} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
            <span className="text-xs text-success flex items-center gap-1 mt-1">
              <FiCheckCircle size={13} /> {fileName}
            </span>
          </>
        ) : (
          <>
            <div className="h-11 w-11 rounded-full bg-nude-100 flex items-center justify-center text-nude-600">
              <FiUploadCloud size={20} />
            </div>
            <span className="text-sm font-medium text-ink-soft">Tap to upload a screenshot</span>
            <span className="text-xs text-ink-muted">PNG, JPG up to 5MB</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
