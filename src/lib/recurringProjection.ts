export function normalizeRecurringDescription(description?: string | null) {
  return (description ?? '').trim().toLowerCase();
}

export function buildRecurringLooseSignature(type: string, description?: string | null) {
  return `${type}|${normalizeRecurringDescription(description)}`;
}

export function buildRecurringSignature(type: string, value: number, description?: string | null) {
  return `${type}|${normalizeRecurringDescription(description)}|${Number(value).toFixed(2)}`;
}

export function buildMonthRecurringSignature(monthKey: string, type: string, value: number, description?: string | null) {
  return `${monthKey}|${buildRecurringSignature(type, value, description)}`;
}

export function buildRecurringExceptionSignature(templateId: string, occurrenceDate: string) {
  return `${templateId}|${occurrenceDate}`;
}

export function shouldProjectRecurringInMonth(
  templateDate: string,
  selectedYear: number,
  selectedMonth: number,
  frequency?: string | null,
) {
  const template = new Date(`${templateDate}T12:00:00`);
  const templateMonthIndex = template.getFullYear() * 12 + template.getMonth();
  const selectedMonthIndex = selectedYear * 12 + selectedMonth;

  if (selectedMonthIndex < templateMonthIndex) return false;

  if (frequency === 'yearly') {
    return template.getMonth() === selectedMonth;
  }

  return true;
}

export function buildFutureRecurringExceptionDates(
  templateDate: string,
  fromDate: string,
  frequency?: string | null,
  yearsAhead = 10,
) {
  const normalizedFrequency = frequency === 'annual' ? 'yearly' : (frequency ?? 'monthly');
  const template = new Date(`${templateDate}T12:00:00`);
  const effective = new Date(`${fromDate}T12:00:00`);
  const dates: string[] = [];

  if (normalizedFrequency === 'yearly') {
    for (let year = effective.getFullYear(); year <= effective.getFullYear() + yearsAhead; year++) {
      const month = template.getMonth();
      const day = Math.min(template.getDate(), new Date(year, month + 1, 0).getDate());
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
    return dates;
  }

  if (normalizedFrequency === 'weekly') {
    const cursor = new Date(`${templateDate}T12:00:00`);
    while (cursor < effective) {
      cursor.setDate(cursor.getDate() + 7);
    }

    const end = new Date(`${fromDate}T12:00:00`);
    end.setFullYear(end.getFullYear() + yearsAhead);

    while (cursor <= end) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
      cursor.setDate(cursor.getDate() + 7);
    }

    return dates;
  }

  let monthIndex = effective.getFullYear() * 12 + effective.getMonth();
  const lastMonthIndex = (effective.getFullYear() + yearsAhead) * 12 + effective.getMonth();

  while (monthIndex <= lastMonthIndex) {
    const year = Math.floor(monthIndex / 12);
    const month = monthIndex % 12;
    const day = Math.min(template.getDate(), new Date(year, month + 1, 0).getDate());
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    monthIndex += 1;
  }

  return dates;
}

type MaterializedRecurringLike = {
  type: string;
  description?: string | null;
  final_category?: string | null;
  wallet_id?: string | null;
  credit_card_id?: string | null;
  payment_method?: string | null;
  project_id?: string | null;
  is_recurring?: boolean;
};

export function buildMaterializedRecurringSignature(item: MaterializedRecurringLike) {
  return [
    item.type,
    normalizeRecurringDescription(item.description),
    item.final_category ?? '',
    item.wallet_id ?? '',
    item.credit_card_id ?? '',
    item.payment_method ?? '',
    item.project_id ?? '',
  ].join('|');
}

export function hideMaterializedRecurringTemplates<T extends MaterializedRecurringLike>(items: T[]) {
  const materializedSignatures = new Set(
    items
      .filter(item => !item.is_recurring)
      .map(item => buildMaterializedRecurringSignature(item))
  );

  return items.filter(item => !(item.is_recurring && materializedSignatures.has(buildMaterializedRecurringSignature(item))));
}

/**
 * Motor único de projeção de recorrências de UM mês.
 * Usado tanto para o mês selecionado quanto para cada mês passado no cálculo do
 * "Saldo Anterior", garantindo que o saldo inicial do mês N seja exatamente o
 * saldo previsto do mês N-1 (mesmas regras de deduplicação e exceções).
 */
export function buildEffectiveMonthExpenses<T extends MaterializedRecurringLike & { id?: string; date: string; value: number; frequency?: string | null }>({
  monthExpenses,
  recurringTemplates,
  year,
  month,
  exceptionSet,
}: {
  monthExpenses: T[];
  recurringTemplates: T[];
  year: number;
  month: number;
  exceptionSet: Set<string>;
}): T[] {
  const visible = hideMaterializedRecurringTemplates(monthExpenses);

  const realSignatures = new Set(visible.map(e => buildRecurringSignature(e.type, e.value, e.description)));
  const realLooseSignatures = new Set(visible.map(e => buildRecurringLooseSignature(e.type, e.description)));
  const materializedSignatures = new Set(
    visible.filter(e => !e.is_recurring).map(e => buildMaterializedRecurringSignature(e)),
  );
  const realIds = new Set(visible.map(e => e.id));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const virtualEntries: T[] = [];

  recurringTemplates.forEach(template => {
    if (template.id && realIds.has(template.id)) return;
    if (template.type === 'transfer' || template.credit_card_id) return;
    if (!shouldProjectRecurringInMonth(template.date, year, month, template.frequency)) return;
    if (
      realSignatures.has(buildRecurringSignature(template.type, template.value, template.description)) ||
      realLooseSignatures.has(buildRecurringLooseSignature(template.type, template.description)) ||
      materializedSignatures.has(buildMaterializedRecurringSignature(template))
    )
      return;

    const originalDay = new Date(`${template.date}T12:00:00`).getDate();
    const day = Math.min(originalDay, daysInMonth);
    const occurrenceDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (exceptionSet.has(buildRecurringExceptionSignature(template.id ?? '', occurrenceDate))) return;

    virtualEntries.push({ ...template, date: occurrenceDate, is_paid: false } as T);
  });

  return [...visible, ...virtualEntries];
}
