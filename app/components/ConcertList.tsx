"use client";

import { useState, useMemo } from "react";
import { Concert } from "@/lib/types";
import ConcertCard from "./ConcertCard";
import FilterBar, { PriceFilter } from "./FilterBar";

function groupByDate(concerts: Concert[]): Map<string, Concert[]> {
  const groups = new Map<string, Concert[]>();
  for (const concert of concerts) {
    const dateKey = concert.date.split("T")[0];
    const existing = groups.get(dateKey) || [];
    existing.push(concert);
    groups.set(dateKey, existing);
  }
  return groups;
}

function formatGroupDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateNoon = new Date(dateStr + "T12:00:00");

  if (dateNoon.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (dateNoon.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function ConcertList({ concerts }: { concerts: Concert[] }) {
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const filtered = useMemo(() => {
    let result = concerts;

    // Price filter
    if (priceFilter === "free") {
      result = result.filter(
        (c) => c.price_cents === 0 || c.price.toLowerCase() === "free"
      );
    } else if (priceFilter === "under20") {
      result = result.filter(
        (c) =>
          c.price_cents !== null && c.price_cents <= 2000
      );
    } else if (priceFilter === "under50") {
      result = result.filter(
        (c) =>
          c.price_cents !== null && c.price_cents <= 5000
      );
    }

    // Tag filter (show concerts that have ANY of the selected tags)
    if (selectedTags.length > 0) {
      result = result.filter((c) =>
        c.tags.some((t) => selectedTags.includes(t))
      );
    }

    return result;
  }, [concerts, priceFilter, selectedTags]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div>
      <FilterBar
        priceFilter={priceFilter}
        onPriceFilterChange={setPriceFilter}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        concertCount={filtered.length}
      />

      <div className="mx-auto max-w-2xl px-4">
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-stone-400 dark:text-stone-500">
            No concerts match your filters.
          </div>
        ) : (
          Array.from(grouped.entries()).map(([dateKey, dayConcerts]) => (
            <section key={dateKey} className="mt-6 first:mt-4">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {formatGroupDate(dateKey)}
              </h2>
              <div>
                {dayConcerts.map((concert) => (
                  <ConcertCard key={concert.id} concert={concert} />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
