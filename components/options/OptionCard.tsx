"use client";

import React from "react";
import { PlanningOption } from "@/lib/types/plan";
import { formatCurrency } from "@/lib/planning/budget";
import {
  MapPin,
  ExternalLink,
  Star,
  CheckCircle2,
  AlertTriangle,
  BadgeCheck,
  Compass,
  Navigation,
} from "lucide-react";

interface OptionCardProps {
  option: PlanningOption;
  isSelected: boolean;
  onSelect: (optionId: string) => void;
  currency?: string;
  guestCount?: number;
}

export function OptionCard({
  option,
  isSelected,
  onSelect,
  currency = "INR",
  guestCount = 1,
}: OptionCardProps) {
  const provenanceKind = option.provenance[0]?.kind ?? "unknown";

  // Calculate effective price display
  let priceDisplay: string | null = null;
  if (option.price?.amount !== undefined) {
    const raw = option.price.amount;
    if (option.price.basis === "per_person") {
      const totalForGuests = raw * (guestCount > 0 ? guestCount : 1);
      priceDisplay = `${formatCurrency(raw, currency)} / person (${formatCurrency(totalForGuests, currency)} for ${guestCount} guests)`;
    } else {
      priceDisplay = formatCurrency(raw, currency);
    }
  }

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-200 ${
        isSelected
          ? "border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20 shadow-sm"
          : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm"
      }`}
    >
      <div>
        {/* Header with Title and Provenance Badge */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-stone-900">{option.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {option.category === "travel" ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  <Navigation className="h-3 w-3" />
                  Transit / Commute
                </span>
              ) : option.category ? (
                <span className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                  {option.category}
                </span>
              ) : null}
            </div>
          </div>

          {/* Provenance Badge */}
          {provenanceKind === "verified_source" && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
              title={option.provenance[0]?.note || "Verified place data from source"}
            >
              <BadgeCheck className="h-3 w-3 text-emerald-600" />
              Verified Source
            </span>
          )}
          {provenanceKind === "estimate" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Estimated
            </span>
          )}
          {provenanceKind === "user_provided" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
              User Provided
            </span>
          )}
        </div>

        {/* Short description */}
        {option.description && (
          <p className="mt-1 text-xs text-stone-600 leading-relaxed">
            {option.description}
          </p>
        )}

        {/* Key Metrics: Rating, Price, Address */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-700">
          {option.rating && (
            <div className="inline-flex items-center gap-1 font-medium text-amber-900 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              <span>{option.rating.value.toFixed(1)}</span>
              {option.rating.reviewCount && (
                <span className="text-stone-500">
                  ({option.rating.reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          )}

          {priceDisplay && (
            <div className="font-semibold text-stone-900">
              {priceDisplay}
              {option.price?.isEstimate && (
                <span className="ml-1 text-[10px] font-normal text-stone-500">
                  (estimate)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Location & Directions */}
        {option.location?.address && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-stone-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-stone-400 mt-0.5" />
            <span className="line-clamp-2">{option.location.address}</span>
            {option.location.directionsUrl && (
              <a
                href={option.location.directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-0.5 text-brand-600 hover:text-brand-700 underline font-medium ml-1"
                aria-label={`Get directions to ${option.name}`}
              >
                <Compass className="h-3 w-3" />
                Directions
              </a>
            )}
          </div>
        )}

        {/* Fit Reasons */}
        {option.fitReasons && option.fitReasons.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-stone-700">
            {option.fitReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 mt-0.5" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Warnings / Caveats */}
        {option.warnings && option.warnings.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {option.warnings.map((warning, i) => (
              <li key={i} className="flex items-start gap-1.5 bg-amber-50/60 p-1.5 rounded-md border border-amber-200/40">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs">
        {/* Source & Booking links */}
        <div className="flex items-center gap-3">
          {option.sourceUrl && (
            <a
              href={option.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-800 transition-colors"
            >
              <span>View Source</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {option.bookingUrl && (
            <a
              href={option.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-medium transition-colors"
              title="Opens venue website or reservation page in new tab. Does not create booking in GatherWise."
            >
              <span>Official Site / Booking</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Selection Button */}
        <button
          type="button"
          onClick={() => onSelect(option.id)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            isSelected
              ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600"
              : "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 hover:border-stone-400 focus:ring-brand-500"
          }`}
          aria-pressed={isSelected}
        >
          {isSelected ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-white" />
              <span>Selected for Plan</span>
            </>
          ) : (
            <span>Choose this Option</span>
          )}
        </button>
      </div>
    </div>
  );
}
