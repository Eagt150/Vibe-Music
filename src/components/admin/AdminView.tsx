import { useMutation, useQuery } from "convex/react";
import { Check, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { useLocale } from "@/i18n/LocaleContext";
import { Button } from "@/components/ui/Button";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { formatAgo } from "@/lib/chatTime";

/** Admin-only: approve or reject people who asked for an account. */
export function AdminView() {
  const { t, locale } = useLocale();
  const requests = useQuery(api.users.listAccessRequests);
  const review = useMutation(api.users.reviewAccessRequest);

  return (
    <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
      <div className="max-w-2xl">
        <div className="text-2xl font-extrabold tracking-tight">{t("admin.title")}</div>
        <div className="text-base text-text-dim mt-1 mb-6">{t("admin.subtitle")}</div>

        {requests?.length === 0 && (
          <div className="bg-surface border border-border rounded-lg px-5 py-8 text-center text-base text-text-dim">
            {t("admin.empty")}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {requests?.map((r) => (
            <div key={r._id} className="flex items-center gap-3 bg-surface border border-border rounded-lg px-4 py-3">
              <UserAvatar name={r.displayName} url={r.avatarUrl} size={40} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base truncate">@{r.username}</div>
                <div className="text-sm text-text-dim">{t("admin.requestedAgo", { time: formatAgo(r.requestedAt, locale) })}</div>
              </div>
              <Button size="sm" icon={<Check size={13} />} onClick={() => void review({ userId: r._id, approve: true })}>
                {t("admin.approve")}
              </Button>
              <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={() => void review({ userId: r._id, approve: false })}>
                {t("admin.reject")}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
