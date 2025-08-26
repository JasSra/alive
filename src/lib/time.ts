export function rangeToFromTo(range: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  const past = new Date(now);
  switch (range) {
    case "5m":
      past.setMinutes(past.getMinutes() - 5);
      break;
    case "20m":
      past.setMinutes(past.getMinutes() - 20);
      break;
    case "1h":
      past.setHours(past.getHours() - 1);
      break;
    case "6h":
      past.setHours(past.getHours() - 6);
      break;
    case "24h":
      past.setDate(past.getDate() - 1);
      break;
    case "7d":
      past.setDate(past.getDate() - 7);
      break;
    default:
      past.setMinutes(past.getMinutes() - 5); // Default to T-5M for live monitoring
  }
  return { from: past.toISOString(), to };
}
