export function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
}

export function minutes(seconds: number | null): string {
  const m = Math.round((seconds ?? 0) / 60);
  return m < 1 ? "< 1 min" : `${m} min`;
}
