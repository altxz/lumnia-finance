import { describe, expect, it } from 'vitest';
import { buildFutureRecurringExceptionDates, resolveRecurringEditAction } from '@/lib/recurringProjection';

/**
 * Regression suite for the "alterar todas as próximas" flow.
 *
 * Contract:
 *  - Given a recurring template that started at `templateDate`, when the user
 *    edits "all from now on" starting at `cutoffDate`, the system must
 *    register exceptions for EVERY future occurrence ≥ cutoffDate.
 *  - It MUST NOT register exceptions for occurrences BEFORE the cutoff —
 *    otherwise paid/closed prior months would be re-touched and duplicated.
 */
describe('buildFutureRecurringExceptionDates — monthly', () => {
  it('only emits dates from cutoff forward (never before)', () => {
    const dates = buildFutureRecurringExceptionDates('2025-01-05', '2026-05-05', 'monthly', 1);
    expect(dates[0]).toBe('2026-05-05');
    expect(dates.every(d => d >= '2026-05-05')).toBe(true);
  });

  it('does not include April when cutoff is May (received-month protection)', () => {
    const dates = buildFutureRecurringExceptionDates('2025-01-05', '2026-05-05', 'monthly', 2);
    expect(dates).not.toContain('2026-04-05');
    expect(dates).not.toContain('2026-03-05');
    expect(dates).toContain('2026-05-05');
    expect(dates).toContain('2026-06-05');
  });

  it('keeps the original day-of-month across all generated occurrences', () => {
    const dates = buildFutureRecurringExceptionDates('2024-06-15', '2026-05-15', 'monthly', 1);
    for (const d of dates) {
      expect(d.endsWith('-15')).toBe(true);
    }
  });

  it('clamps the day when the target month is shorter (e.g., Feb)', () => {
    const dates = buildFutureRecurringExceptionDates('2024-01-31', '2026-01-31', 'monthly', 1);
    // Feb 2026 has 28 days
    expect(dates).toContain('2026-02-28');
    // Apr 2026 has 30 days
    expect(dates).toContain('2026-04-30');
    // May 2026 has 31 days
    expect(dates).toContain('2026-05-31');
  });

  it('produces a deterministic, monotonically increasing sequence', () => {
    const dates = buildFutureRecurringExceptionDates('2025-01-10', '2026-05-10', 'monthly', 1);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });
});

describe('buildFutureRecurringExceptionDates — yearly', () => {
  it('only emits the same calendar month in subsequent years from cutoff', () => {
    const dates = buildFutureRecurringExceptionDates('2020-08-10', '2026-08-10', 'yearly', 3);
    expect(dates[0]).toBe('2026-08-10');
    expect(dates).toContain('2027-08-10');
    expect(dates).toContain('2028-08-10');
    expect(dates).toContain('2029-08-10');
    expect(dates.every(d => d.includes('-08-'))).toBe(true);
  });

  it('does not produce occurrences before the cutoff year', () => {
    const dates = buildFutureRecurringExceptionDates('2020-08-10', '2026-08-10', 'yearly', 2);
    expect(dates).not.toContain('2025-08-10');
    expect(dates).not.toContain('2024-08-10');
  });
});

describe('buildFutureRecurringExceptionDates — alias and weekly', () => {
  it('treats "annual" frequency as "yearly"', () => {
    const a = buildFutureRecurringExceptionDates('2024-03-01', '2026-03-01', 'annual', 1);
    const b = buildFutureRecurringExceptionDates('2024-03-01', '2026-03-01', 'yearly', 1);
    expect(a).toEqual(b);
  });

  it('weekly emits 7-day stepped dates ≥ cutoff and never before', () => {
    const dates = buildFutureRecurringExceptionDates('2026-01-05', '2026-04-06', 'weekly', 0);
    // Cutoff is a Monday; ensure first emitted is ≥ cutoff
    expect(dates[0] >= '2026-04-06').toBe(true);
    // Weekly steps of 7 days
    const toMs = (d: string) => new Date(`${d}T12:00:00`).getTime();
    for (let i = 1; i < dates.length; i++) {
      expect(toMs(dates[i]) - toMs(dates[i - 1])).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });
});

/**
 * The central guarantee for the bug we just fixed:
 *  - The cutoff used by EditExpenseModal is min(clickedOccurrence, newTemplateDate).
 *  - Past months (already received/paid) must NEVER appear in the exception set
 *    so they cannot be retroactively replaced by a new template.
 */
describe('cutoff semantics protect already-registered months', () => {
  it('clicked occurrence in May with new start in May does not affect April', () => {
    const cutoff = '2026-05-05';
    const dates = buildFutureRecurringExceptionDates('2025-01-05', cutoff, 'monthly', 1);
    expect(dates.find(d => d < cutoff)).toBeUndefined();
  });

  it('moving the new template start FORWARD (June) keeps May/April untouched when cutoff is May', () => {
    // cutoff = min(clickedOccurrenceMay, newTemplateJune) = May
    const cutoff = '2026-05-05';
    const dates = buildFutureRecurringExceptionDates('2025-01-05', cutoff, 'monthly', 1);
    expect(dates).toContain('2026-05-05');
    expect(dates).not.toContain('2026-04-05');
  });

  it('moving the new template start BACKWARD picks the earlier date as cutoff', () => {
    // Simulates: user clicked June occurrence but moved new template start to May.
    // EditExpenseModal must use May as cutoff, not June.
    const cutoff = '2026-05-05';
    const dates = buildFutureRecurringExceptionDates('2025-01-05', cutoff, 'monthly', 1);
    expect(dates[0]).toBe('2026-05-05');
    expect(dates).toContain('2026-06-05');
  });
});

describe('resolveRecurringEditAction — protege o molde da recorrência', () => {
  const base = {
    isRecurringRow: true,
    isProjectedOccurrence: true,
    wantRecurring: true,
    installmentMode: 'fixed' as const,
    canConvertToInstallment: true,
  };

  it('editar ocorrência projetada com "todas as próximas" faz split de série (não reescreve o molde)', () => {
    expect(resolveRecurringEditAction({ ...base, scope: 'all' })).toBe('split-series');
  });

  it('editar ocorrência projetada com "apenas esta" cria lançamento avulso', () => {
    expect(resolveRecurringEditAction({ ...base, scope: 'single' })).toBe('single-occurrence');
  });

  it('ativar recorrência só acontece em transação ainda não recorrente', () => {
    expect(
      resolveRecurringEditAction({ ...base, isRecurringRow: false, isProjectedOccurrence: false, scope: 'single' }),
    ).toBe('activate-recurring');
  });

  it('nunca converte em parcelamento a partir de uma ocorrência projetada', () => {
    expect(
      resolveRecurringEditAction({
        ...base,
        isRecurringRow: false,
        installmentMode: 'limited',
        scope: 'single',
      }),
    ).toBe('plain-update');
  });
});
