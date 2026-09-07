import { forwardRef } from "react";

interface HiddenFileInputProps {
  accept: string;
  multiple?: boolean;
  onFiles: (files: FileList) => void;
}

export const HiddenFileInput = forwardRef<HTMLInputElement, HiddenFileInputProps>(function HiddenFileInput(
  { accept, multiple, onFiles },
  ref
) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      style={{ display: "none" }}
      onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
        e.target.value = "";
      }}
    />
  );
});
