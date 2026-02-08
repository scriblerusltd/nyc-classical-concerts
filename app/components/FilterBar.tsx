"use client";

export type PriceFilter = "all" | "free" | "under20" | "under50";

interface FilterBarProps {
  priceFilter: PriceFilter;
  onPriceFilterChange: (filter: PriceFilter) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  concertCount: number;
}

const PRICE_OPTIONS: { value: PriceFilter; label: string }[] = [
  { value: "all", label: "All prices" },
  { value: "free", label: "Free" },
  { value: "under20", label: "Under $20" },
  { value: "under50", label: "Under $50" },
];

const TAG_OPTIONS = [
  "chamber",
  "orchestral",
  "solo",
  "choral",
  "organ",
  "opera",
  "new-music",
  "church",
];

export default function FilterBar({
  priceFilter,
  onPriceFilterChange,
  selectedTags,
  onTagToggle,
  concertCount,
}: FilterBarProps) {
  return (
    <div className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/95 backdrop-blur-sm dark:border-stone-800 dark:bg-stone-950/95">
      <div className="mx-auto max-w-2xl px-4 py-3">
        {/* Price filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRICE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onPriceFilterChange(option.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                priceFilter === option.value
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-stone-200/60 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              }`}
            >
              {option.label}
            </button>
          ))}

          <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
            {concertCount} concert{concertCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tag filters */}
        <div className="mt-2 flex flex-wrap gap-1">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                selectedTags.includes(tag)
                  ? "bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900"
                  : "bg-stone-200/60 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
