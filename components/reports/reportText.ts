// Translated catalogue text for a report (title, description, features,
// questions, discoveries, testimonials).
// Keys: "reports.item.<id>.title" etc.; a missing key shows the reports.json text.

type T = (key: string, vars?: Record<string, string | number>) => string;

const pick = (t: T, key: string, fallback: string) => {
  const text = t(key);
  return text === key ? fallback : text;
};

export const reportTitle = (t: T, r: { id: string; title: string }) =>
  pick(t, `reports.item.${r.id}.title`, r.title);

export const reportDescription = (t: T, r: { id: string; description: string }) =>
  pick(t, `reports.item.${r.id}.description`, r.description);

/** Long content: questions, discoveries, testimonial text (by position). */
export const reportQuestion = (t: T, reportId: string, index: number, text: string) =>
  pick(t, `reports.item.${reportId}.question.${index}`, text);

export const reportDiscovery = (t: T, reportId: string, index: number, text: string) =>
  pick(t, `reports.item.${reportId}.discovery.${index}`, text);

export const testimonialText = (t: T, reportId: string, index: number, text: string) =>
  pick(t, `reports.item.${reportId}.testimonial.${index}`, text);

export const featureLabel = (t: T, reportId: string, index: number, label: string) =>
  pick(t, `reports.item.${reportId}.feature.${index}`, label);

/** "One time" / "Monthly". */
export const frequencyLabel = (t: T, frequency: string) =>
  frequency === "Monthly" ? t("reports.frequency.monthly") : frequency === "One time" ? t("reports.frequency.oneTime") : frequency;

/** "80% OFF" -> "80% छूट". */
export const discountLabel = (t: T, discount: string) => {
  const match = /(\d+)\s*%/.exec(discount || "");
  return match ? t("reports.percentOff", { percent: match[1] }) : discount;
};

/** Short month name ("Oct"), index 0-11. */
export const monthShort = (t: T, index: number) => t(`reports.month.${index}`);
