/**
 * Porte de buildFutureRecurringExceptionDates (src/lib/recurringProjection.ts)
 * para o runtime Deno. Usado no "split de série" ao editar recorrências
 * preservando os meses anteriores.
 */

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function buildFutureRecurringExceptionDates(
  templateDate: string,
  fromDate: string,
  frequency?: string | null,
  yearsAhead = 10,
): string[] {
  const normalizedFrequency = frequency === "annual" ? "yearly" : (frequency ?? "monthly");
  const template = new Date(`${templateDate}T12:00:00`);
  const effective = new Date(`${fromDate}T12:00:00`);
  const dates: string[] = [];

  if (normalizedFrequency === "yearly") {
    for (let year = effective.getFullYear(); year <= effective.getFullYear() + yearsAhead; year++) {
      const month = template.getMonth();
      const day = Math.min(template.getDate(), new Date(year, month + 1, 0).getDate());
      dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    }
    return dates;
  }

  if (normalizedFrequency === "weekly") {
    const cursor = new Date(`${templateDate}T12:00:00`);
    while (cursor < effective) cursor.setDate(cursor.getDate() + 7);
    const end = new Date(`${fromDate}T12:00:00`);
    end.setFullYear(end.getFullYear() + yearsAhead);
    while (cursor <= end) {
      dates.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
      cursor.setDate(cursor.getDate() + 7);
    }
    return dates;
  }

  let monthIndex = effective.getFullYear() * 12 + effective.getMonth();
  const lastMonthIndex = (effective.getFullYear() + yearsAhead) * 12 + effective.getMonth();
  const originalDay = template.getDate();

  while (monthIndex <= lastMonthIndex) {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const day = Math.min(originalDay, new Date(year, month + 1, 0).getDate());
    dates.push(`${year}-${pad(month + 1)}-${pad(day)}`);
    monthIndex++;
  }

  return dates;
}
