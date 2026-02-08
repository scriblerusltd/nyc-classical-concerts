// Quick test: verify dates render correctly in Node.js
const testDates = [
  { input: "2026-02-10T14:00:00", expected: "2:00 PM", label: "Njioma Grevious (Feb, EST)" },
  { input: "2026-02-10T14:00:00-05:00", expected: "2:00 PM", label: "Already has EST offset" },
  { input: "2026-02-10T14:00:00Z", expected: "2:00 PM", label: "Juilliard UTC (should be local)" },
  { input: "2026-02-09T19:30:00", expected: "7:30 PM", label: "Israeli Chamber Project (Feb, EST)" },
  { input: "2026-04-15T19:30:00", expected: "7:30 PM", label: "Spring event (Apr, EDT)" },
  { input: "2026-03-10T19:30:00", expected: "7:30 PM", label: "March after DST (EDT)" },
  { input: "2026-03-07T19:30:00", expected: "7:30 PM", label: "March before DST (EST)" },
];

function isEDT(dateStr: string): boolean {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  if (month === 3) {
    const firstDay = new Date(year, 2, 1).getDay();
    const secondSunday = firstDay === 0 ? 8 : 15 - firstDay;
    return day >= secondSunday;
  }
  const firstDay = new Date(year, 10, 1).getDay();
  const firstSunday = firstDay === 0 ? 1 : 8 - firstDay;
  return day < firstSunday;
}

function normalizeDate(dateStr: string): string {
  const naive = dateStr.replace(/Z$/, "").replace(/[+-]\d{2}:\d{2}$/, "");
  const offset = isEDT(naive) ? "-04:00" : "-05:00";
  return naive + offset;
}

for (const { input, expected, label } of testDates) {
  const normalized = normalizeDate(input);
  const date = new Date(normalized);
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
  const ok = time === expected ? "✓" : "✗";
  console.log(`${ok} ${label}`);
  console.log(`  Input: ${input} → ${normalized}`);
  console.log(`  Rendered: ${time} (expected: ${expected})`);
  console.log();
}
