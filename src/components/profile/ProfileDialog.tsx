import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { ImagePlus, LogOut, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useLocale } from "@/i18n/LocaleContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { HiddenFileInput } from "@/components/ui/HiddenFileInput";
import { SignOutConfirm } from "@/components/auth/SignOutConfirm";
import { ProfileCard } from "@/components/user/ProfileCard";
import { UserRow } from "@/components/user/UserRow";
import { ImageTooBigError, prepareProfileImage, uploadBlob, PROFILE_IMAGE_MAX_BYTES, type ProfileImageSlot } from "@/lib/profileImages";
import { convexErrorCode } from "@/lib/convexError";
import { setNotificationPrefs, systemNotificationsSupported, useNotificationPrefs } from "@/lib/notificationPrefs";
import { playMessageSound } from "@/lib/messageSound";
import { cn } from "@/lib/cn";

const ACCEPTED_IMAGES = "image/png,image/jpeg,image/webp,image/gif";
const TAG_EMOJIS = ["💗", "🌙", "⚡", "🔥", "🎵", "⭐", "🍀", "👾", "🌸", "💎"];
const MAX_BIO = 190;

type ColorMode = "none" | "solid" | "gradient";

interface Form {
  displayName: string;
  bio: string;
  colorMode: ColorMode;
  nameColor: string;
  nameColor2: string;
  tagEmoji: string;
  tagText: string;
  cardTheme: boolean;
  cardColor1: string;
  cardColor2: string;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-bold text-text-dim">{title}</div>
      {children}
    </div>
  );
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="w-10 h-9 rounded-md border border-border bg-input-bg cursor-pointer p-1"
    />
  );
}

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLocale();
  const me = useQuery(api.users.me);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const setProfileImage = useMutation(api.users.setProfileImage);
  const removeProfileImage = useMutation(api.users.removeProfileImage);
  const updateProfile = useMutation(api.users.updateProfile);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<ProfileImageSlot>("avatar");

  const [form, setForm] = useState<Form | null>(null);
  const [uploading, setUploading] = useState<ProfileImageSlot | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const prefs = useNotificationPrefs();
  const [notifyNote, setNotifyNote] = useState<string | null>(null);

  // Seed the form once, when the dialog opens — not on every live update.
  useEffect(() => {
    if (!me || form) return;
    setForm({
      displayName: me.rawDisplayName,
      bio: me.bio,
      colorMode: me.nameColor ? (me.nameColor2 ? "gradient" : "solid") : "none",
      nameColor: me.nameColor ?? "#2f7dff",
      nameColor2: me.nameColor2 ?? "#ff5470",
      tagEmoji: me.tag?.emoji ?? "",
      tagText: me.tag?.text ?? "",
      cardTheme: me.cardColor1 !== null,
      cardColor1: me.cardColor1 ?? "#1c1c3a",
      cardColor2: me.cardColor2 ?? "#7a2f6b",
    });
  }, [me, form]);

  if (!me || !form) return null;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setSaved(false);
  };

  // What the card and row look like with the unsaved changes.
  const tagText = form.tagText.trim().toUpperCase();
  const previewUser = {
    ...me,
    displayName: form.displayName.trim() || me.username,
    nameColor: form.colorMode === "none" ? null : form.nameColor,
    nameColor2: form.colorMode === "gradient" ? form.nameColor2 : null,
    tag: tagText ? { emoji: form.tagEmoji.trim(), text: tagText } : null,
  };
  const previewProfile = {
    ...previewUser,
    bio: form.bio,
    bannerUrl: me.bannerUrl,
    bannerStillUrl: me.bannerStillUrl,
    cardBgUrl: me.cardBgUrl,
    cardBgStillUrl: me.cardBgStillUrl,
    cardColor1: form.cardTheme ? form.cardColor1 : null,
    cardColor2: form.cardTheme ? form.cardColor2 : null,
  };

  function pickImage(slot: ProfileImageSlot) {
    pendingSlot.current = slot;
    fileRef.current?.click();
  }

  async function handleImage(files: FileList) {
    const slot = pendingSlot.current;
    const file = files[0];
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t("profile.errorImage"));
    setUploading(slot);
    try {
      const { main, still } = await prepareProfileImage(file, slot);
      const storageId = (await uploadBlob(await generateUploadUrl(), main)) as Id<"_storage">;
      const stillId = still ? ((await uploadBlob(await generateUploadUrl(), still)) as Id<"_storage">) : undefined;
      await setProfileImage({ slot, storageId, stillId });
    } catch (err) {
      const tooBig = err instanceof ImageTooBigError || convexErrorCode(err) === "IMAGE_TOO_BIG";
      setError(
        tooBig
          ? t("profile.errorTooBig", { mb: PROFILE_IMAGE_MAX_BYTES[slot] / 1024 / 1024 })
          : t("profile.errorImage")
      );
    } finally {
      setUploading(null);
    }
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        displayName: form.displayName,
        bio: form.bio,
        nameColor: form.colorMode === "none" ? null : form.nameColor,
        nameColor2: form.colorMode === "gradient" ? form.nameColor2 : null,
        tagEmoji: form.tagEmoji,
        tagText: form.tagText,
        cardColor1: form.cardTheme ? form.cardColor1 : null,
        cardColor2: form.cardTheme ? form.cardColor2 : null,
      });
      setSaved(true);
    } catch (err) {
      const code = convexErrorCode(err);
      setError(
        code === "INVALID_TAG"
          ? t("profile.errorTag")
          : code === "INVALID_EMOJI"
            ? t("profile.errorEmoji")
            : t("profile.errorSave")
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleSystemNotifications(enabled: boolean) {
    setNotifyNote(null);
    if (!enabled) return setNotificationPrefs({ systemNotifications: false });
    const permission =
      Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission === "granted") setNotificationPrefs({ systemNotifications: true });
    else setNotifyNote(t("profile.notificationsBlocked"));
  }

  const imageSlots: { slot: ProfileImageSlot; label: string; has: boolean }[] = [
    { slot: "avatar", label: t("profile.photo"), has: me.avatarUrl !== null },
    { slot: "banner", label: t("profile.banner"), has: me.hasBanner },
    { slot: "nameplate", label: t("profile.nameplate"), has: me.nameplateUrl !== null },
    { slot: "cardBg", label: t("profile.cardBackground"), has: me.hasCardBg },
  ];

  return (
    <Modal onClose={onClose} xl>
      <div className="max-h-[85vh] overflow-y-auto -mx-1 px-1">
        <div className="text-md font-extrabold mb-4">{t("profile.title")}</div>
        <HiddenFileInput ref={fileRef} accept={ACCEPTED_IMAGES} onFiles={(f) => void handleImage(f)} />

        <div className="grid md:grid-cols-[1fr_300px] gap-6">
          {/* --- Editor --- */}
          <div className="flex flex-col gap-5 min-w-0">
            <Section title={t("profile.images")}>
              <p className="text-xs text-text-faint -mt-1">{t("profile.imagesHint")}</p>
              <div className="grid grid-cols-2 gap-2">
                {imageSlots.map(({ slot, label, has }) => (
                  <div key={slot} className="flex items-center gap-1.5 bg-surface-alt rounded-md px-2.5 py-2">
                    <span className="flex-1 text-sm font-bold truncate">{label}</span>
                    <button
                      type="button"
                      onClick={() => pickImage(slot)}
                      disabled={uploading !== null}
                      title={t("profile.changeImage", { what: label })}
                      aria-label={t("profile.changeImage", { what: label })}
                      className="p-1 text-text-dim hover:text-accent cursor-pointer disabled:opacity-40"
                    >
                      {uploading === slot ? <span className="text-xs">…</span> : <ImagePlus size={15} />}
                    </button>
                    {has && (
                      <button
                        type="button"
                        onClick={() => void removeProfileImage({ slot })}
                        title={t("profile.removeImage", { what: label })}
                        aria-label={t("profile.removeImage", { what: label })}
                        className="p-1 text-text-dim hover:text-danger cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            <TextField
              id="displayName"
              label={t("profile.displayName")}
              placeholder={me.username}
              value={form.displayName}
              maxLength={40}
              onChange={(e) => set("displayName", e.target.value)}
            />

            <Section title={t("profile.nameColor")}>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex bg-surface-alt rounded-pill p-0.5">
                  {(["none", "solid", "gradient"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={form.colorMode === mode}
                      onClick={() => set("colorMode", mode)}
                      className={cn(
                        "px-3 py-1 rounded-pill text-sm font-bold cursor-pointer",
                        form.colorMode === mode ? "bg-accent text-accent-text" : "text-text-dim hover:text-text"
                      )}
                    >
                      {mode === "none" ? t("profile.colorNone") : mode === "solid" ? t("profile.colorSolid") : t("profile.colorGradient")}
                    </button>
                  ))}
                </div>
                {form.colorMode !== "none" && (
                  <ColorInput value={form.nameColor} onChange={(v) => set("nameColor", v)} label={t("profile.nameColor")} />
                )}
                {form.colorMode === "gradient" && (
                  <ColorInput value={form.nameColor2} onChange={(v) => set("nameColor2", v)} label={t("profile.nameColor")} />
                )}
              </div>
            </Section>

            <Section title={t("profile.tag")}>
              <div className="flex items-center gap-2">
                <input
                  value={form.tagEmoji}
                  onChange={(e) => set("tagEmoji", e.target.value)}
                  placeholder="💗"
                  maxLength={8}
                  aria-label={t("profile.tagEmoji")}
                  className="w-14 text-center bg-input-bg border border-border rounded-md px-2 py-2 text-md outline-none focus:border-accent"
                />
                <input
                  value={form.tagText}
                  onChange={(e) => set("tagText", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                  placeholder="MC"
                  aria-label={t("profile.tagText")}
                  className="w-24 bg-input-bg border border-border rounded-md px-3 py-2 text-base font-bold tracking-wide outline-none focus:border-accent"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {TAG_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => set("tagEmoji", e)}
                    className="w-8 h-8 rounded-md hover:bg-surface-alt cursor-pointer text-md"
                  >
                    {e}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-faint">{t("profile.tagHint")}</p>
            </Section>

            <Section title={t("profile.bio")}>
              <textarea
                value={form.bio}
                maxLength={MAX_BIO}
                rows={3}
                onChange={(e) => set("bio", e.target.value)}
                placeholder={t("profile.bioPlaceholder")}
                className="w-full resize-none bg-input-bg border border-border rounded-md px-3 py-2.5 text-base outline-none focus:border-accent placeholder:text-text-faint"
              />
              <span className="text-xs text-text-faint text-right">
                {form.bio.length}/{MAX_BIO}
              </span>
            </Section>

            <Section title={t("profile.cardTheme")}>
              <label className="flex items-center gap-2 text-base cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.cardTheme}
                  onChange={(e) => set("cardTheme", e.target.checked)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                {t("profile.cardThemeToggle")}
              </label>
              {form.cardTheme && (
                <div className="flex items-center gap-2">
                  <ColorInput value={form.cardColor1} onChange={(v) => set("cardColor1", v)} label={t("profile.cardTheme")} />
                  <ColorInput value={form.cardColor2} onChange={(v) => set("cardColor2", v)} label={t("profile.cardTheme")} />
                </div>
              )}
            </Section>
          </div>

          {/* --- Live preview --- */}
          <div className="flex flex-col gap-3 md:sticky md:top-0 self-start w-full">
            <div className="text-sm font-bold text-text-dim">{t("stickers.preview")}</div>
            <ProfileCard profile={previewProfile} />
            <div className="bg-bg rounded-md p-1.5 border border-border">
              <UserRow user={previewUser} />
            </div>
          </div>
        </div>

        {error && <div className="text-sm text-danger mt-4">{error}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saved ? t("profile.saved") : t("profile.save")}
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 border-t border-border pt-4 mt-4 mb-4">
          <div className="text-sm font-bold text-text-dim">{t("profile.notificationsTitle")}</div>
          <label className="flex items-center justify-between gap-3 text-base cursor-pointer">
            <span>{t("profile.messageSound")}</span>
            <input
              type="checkbox"
              checked={prefs.messageSound}
              onChange={(e) => {
                setNotificationPrefs({ messageSound: e.target.checked });
                if (e.target.checked) playMessageSound();
              }}
              className="w-4 h-4 accent-[var(--accent)]"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-base cursor-pointer">
            <span>{t("profile.systemNotifications")}</span>
            <input
              type="checkbox"
              disabled={!systemNotificationsSupported}
              checked={prefs.systemNotifications && systemNotificationsSupported && Notification.permission === "granted"}
              onChange={(e) => void toggleSystemNotifications(e.target.checked)}
              className="w-4 h-4 accent-[var(--accent)]"
            />
          </label>
          {(notifyNote || !systemNotificationsSupported) && (
            <div className="text-xs text-text-faint">{notifyNote ?? t("profile.notificationsUnsupported")}</div>
          )}
        </div>

        <div className="flex justify-between gap-2 border-t border-border pt-4">
          <Button variant="ghost" icon={<LogOut size={14} />} onClick={() => setConfirmingSignOut(true)}>
            {t("auth.signOut")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
      {confirmingSignOut && <SignOutConfirm onCancel={() => setConfirmingSignOut(false)} />}
    </Modal>
  );
}
