import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useRateVisit } from "@/data/requests/queries";
import { SheetSection } from "./SheetSection";

/** Star rating shown after checkout (staff-for-invited / VMC-for-walk-in). */
export function RateGuestSection({ visitId }: { visitId: string }) {
  const t = useTranslations("requests");
  const rate = useRateVisit(visitId);
  const [rating, setRating] = React.useState(0);
  const submit = (score: number) => {
    setRating(score);
    rate.mutate({ score });
  };
  return (
    <SheetSection title={t("sections.rateGuest")}>
      <div className="flex items-center justify-center gap-2 py-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => submit(n)}
            disabled={rate.isPending}
            aria-label={String(n)}
          >
            <Star
              className={`size-7 ${
                n <= rating
                  ? "fill-primary text-primary"
                  : "fill-transparent text-border"
              }`}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </SheetSection>
  );
}
