import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Camera, LogOut, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLocale } from "@/i18n/LocaleContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { SignOutConfirm } from "@/components/auth/SignOutConfirm";
import { resizeToSquareJpeg } from "@/lib/resizeImage";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp,image/gif";

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const me = useQuery(api.users.me);
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const setAvatar = useMutation(api.users.setAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);
  const setDisplayName = useMutation(api.users.setDisplayName);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  useEffect(() => {
    if (me) setName(me.displayName === me.username ? "" : me.displayName);
    // Only seed the field when the dialog opens, not on every live update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?._id]);

  if (!me) return null;

  async function handlePhoto(files: FileList) {
    const file = files[0];
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t("profile.errorImage"));
    setUploading(true);
    try {
      const blob = await resizeToSquareJpeg(file);
      const url = await generateUploadUrl();
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await setAvatar({ storageId });
    } catch {
      setError(t("profile.errorImage"));
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    await setDisplayName({ displayName: name });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Modal onClose={onClose}>
      <div className="text-md font-extrabold mb-4">{t("profile.title")}</div>

      <div className="flex items-center gap-4 mb-5">
        <UserAvatar name={me.displayName} url={me.avatarUrl} size={72} />
        <div className="flex flex-col gap-1.5 items-start min-w-0">
          <div className="font-extrabold text-md truncate max-w-full">{me.displayName}</div>
          <div className="text-sm text-text-dim">@{me.username}</div>
          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" variant="secondary" icon={<Camera size={13} />} disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? t("profile.uploading") : t("profile.changePhoto")}
            </Button>
            {me.avatarUrl && (
              <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => void removeAvatar()}>
                {t("profile.removePhoto")}
              </Button>
            )}
          </div>
        </div>
      </div>
      <HiddenFileInput ref={fileRef} accept={ACCEPTED_IMAGES} onFiles={(f) => void handlePhoto(f)} />
      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 items-end mb-5">
        <div className="flex-1">
          <TextField
            id="displayName"
            label={t("profile.displayName")}
            placeholder={me.username}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button variant="secondary" onClick={() => void handleSave()}>
          {saved ? t("profile.saved") : t("profile.save")}
        </Button>
      </div>

      <div className="flex justify-between gap-2 border-t border-border pt-4">
        <Button variant="ghost" icon={<LogOut size={14} />} onClick={() => setConfirmingSignOut(true)}>
          {t("auth.signOut")}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t("common.close")}
        </Button>
      </div>
      {confirmingSignOut && <SignOutConfirm onCancel={() => setConfirmingSignOut(false)} />}
    </Modal>
  );
}
