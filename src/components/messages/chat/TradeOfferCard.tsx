import { useState } from "react";
import { useMutation } from "convex/react";
import { Check, Clock, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useLocale } from "@/i18n/LocaleContext";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/cn";

interface TradeOffer {
  offerId: string;
  expiresAt: number;
  decision?: "enter" | "skip";
}

function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Enter / Skip buttons under a trading bot alert, with a countdown. Once it
 * is answered or the time runs out it just shows what happened. */
export function TradeOfferCard({
  messageId,
  offer,
  canAnswer,
}: {
  messageId: Id<"messages">;
  offer: TradeOffer;
  canAnswer: boolean;
}) {
  const { t } = useLocale();
  const now = useNow(1000);
  const decide = useMutation(api.tradingBot.decideOffer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const left = offer.expiresAt - now;

  if (offer.decision || left <= 0) {
    const entered = offer.decision === "enter";
    return (
      <div
        className={cn(
          "mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-md",
          entered ? "bg-[rgba(34,197,94,0.15)] text-[#22c55e]" : "bg-surface-alt text-text-dim"
        )}
      >
        {entered ? <Check size={14} /> : offer.decision === "skip" ? <X size={14} /> : <Clock size={14} />}
        {entered ? t("messages.offerEntered") : offer.decision === "skip" ? t("messages.offerSkipped") : t("messages.offerExpired")}
      </div>
    );
  }

  async function answer(decision: "enter" | "skip") {
    setBusy(true);
    setError(false);
    try {
      await decide({ messageId, decision });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {canAnswer && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer("enter")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#22c55e] text-black font-bold text-sm cursor-pointer hover:brightness-110 disabled:opacity-50"
          >
            <Check size={15} />
            {t("messages.offerEnter")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer("skip")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-surface-alt border border-border font-bold text-sm cursor-pointer hover:border-text-faint disabled:opacity-50"
          >
            <X size={15} />
            {t("messages.offerSkip")}
          </button>
        </>
      )}
      <span className={cn("inline-flex items-center gap-1 text-xs", left < 60_000 ? "text-danger" : "text-text-dim")}>
        <Clock size={12} />
        {t("messages.offerLeft", { time: mmss(left) })}
      </span>
      {error && <span className="text-xs text-danger">{t("messages.offerExpired")}</span>}
    </div>
  );
}
