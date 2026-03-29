import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard, Clock, Lock, AlertTriangle, ChevronRight, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/constants';
import { getInvoicePeriod, matchExpensesToInvoice, formatInvoiceDate } from '@/lib/invoiceHelpers';
import type { CreditCard as CreditCardType, InvoicePeriod } from '@/lib/invoiceHelpers';
import type { Expense } from '@/components/ExpenseTable';
import { InvoiceDetailsModal } from '@/components/modals/InvoiceDetailsModal';

const STATUS_MAP = {
  open: { label: 'Fatura Aberta', icon: Clock, className: 'text-emerald-400' },
  closed: { label: 'Fatura Fechada', icon: Lock, className: 'text-muted-foreground' },
  overdue: { label: 'Fatura Vencida', icon: AlertTriangle, className: 'text-destructive' },
} as const;

export function CreditCardSummary() {
  const { user } = useAuth();
  const { selectedMonth, selectedYear } = useSelectedDate();
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoicePeriod | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: c }, { data: e }] = await Promise.all([
        supabase.from('credit_cards').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id).not('credit_card_id', 'is', null).order('date', { ascending: false }),
      ]);
      setCards((c || []) as CreditCardType[]);
      setAllExpenses((e || []) as Expense[]);
    })();
  }, [user]);

  const invoices = useMemo(() => {
    return cards.map(card => {
      const period = getInvoicePeriod(card, selectedYear, selectedMonth);
      return matchExpensesToInvoice(allExpenses, period);
    });
  }, [cards, allExpenses, selectedMonth, selectedYear]);

  if (invoices.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center p-6 text-sm text-muted-foreground">
          Nenhum cartão de crédito cadastrado
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded-2xl border-0 shadow-md h-full flex flex-col overflow-hidden">
        <div className="bg-primary px-4 py-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary-foreground" />
          <h3 className="text-sm font-bold text-primary-foreground">Resumo de Cartões</h3>
        </div>
        <CardContent className="flex-1 p-0 overflow-auto divide-y divide-border">
          {invoices.map(inv => {
            const statusInfo = STATUS_MAP[inv.status];
            const StatusIcon = statusInfo.icon;
            const usagePct = inv.limit > 0 ? Math.min((inv.total / inv.limit) * 100, 100) : 0;
            const last5 = inv.transactions.slice(0, 5);

            return (
              <button
                key={inv.cardId}
                onClick={() => setSelectedInvoice(inv)}
                className="w-full text-left p-4 hover:bg-muted/50 transition-colors group"
              >
                {/* Card header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold truncate">{inv.cardName}</span>
                    <div className={`flex items-center gap-1 text-xs font-medium ${statusInfo.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      <span>{statusInfo.label}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                </div>

                {/* Dates */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span>Fecha em {formatInvoiceDate(inv.periodEnd)}</span>
                  <span className="text-border">•</span>
                  <span>Vence em {formatInvoiceDate(inv.dueDate)}</span>
                </div>

                {/* Total + usage bar */}
                <div className="mb-3">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-xl font-extrabold text-foreground">{formatCurrency(inv.total)}</span>
                    <span className="text-xs text-muted-foreground">
                      de {formatCurrency(inv.limit)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${usagePct > 80 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </div>

                {/* Last 5 transactions mini list */}
                {last5.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground font-medium">Últimas transações</p>
                    {last5.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Wallet className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate">{tx.description}</span>
                        </div>
                        <span className="text-xs font-semibold text-destructive shrink-0">
                          -{formatCurrency(tx.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceDetailsModal
          open={!!selectedInvoice}
          invoice={selectedInvoice}
          allExpenses={allExpenses}
          cards={cards}
          onOpenChange={(open) => { if (!open) setSelectedInvoice(null); }}
        />
      )}
    </>
  );
}
