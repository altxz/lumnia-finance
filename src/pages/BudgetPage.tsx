import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Search, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { MonthSelector } from '@/components/MonthSelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedDate } from '@/contexts/DateContext';
import { useBudgetData } from '@/hooks/useBudgetData';
import { BudgetSummaryCards } from '@/components/budget/BudgetSummaryCards';
import { BudgetCategoryRow } from '@/components/budget/BudgetCategoryRow';
import { PageLoadingSkeleton } from '@/components/ui/loading-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { StatePanel } from '@/components/ui/state-panel';
import { OfflineBanner } from '@/components/ui/offline-banner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

type BudgetFilter = 'all' | 'attention' | 'monitored' | 'unconfigured';

function getNodeStatus(node: ReturnType<typeof useBudgetData>['tree'][number]) {
  const childSpentTotal = Object.values(node.childSpent).reduce((sum, value) => sum + value, 0);
  const directParentSpent = Math.max(0, node.spent - childSpentTotal);
  const ratios: number[] = [];
  const parentLimit = Number(node.budget?.allocated_amount || 0);

  if (parentLimit > 0) ratios.push(directParentSpent / parentLimit);
  node.children.forEach(child => {
    const limit = Number(node.childBudgets[child.id]?.allocated_amount || 0);
    if (limit > 0) ratios.push(Number(node.childSpent[child.id] || 0) / limit);
  });

  const maxRatio = ratios.length > 0 ? Math.max(...ratios) : 0;
  return {
    monitored: ratios.length > 0,
    attention: maxRatio >= 0.8,
    maxRatio,
  };
}

export default function BudgetPage() {
  const { user, loading: authLoading } = useAuth();
  const { label: monthLabel } = useSelectedDate();
  const isOnline = useOnlineStatus();
  const { tree, totalAllocated, monitoredSpent, monitoredCount, exceededCount, loading, error, refetch, savingId, saveBudget } = useBudgetData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BudgetFilter>('all');

  const visibleTree = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');

    return tree
      .map(node => ({ node, status: getNodeStatus(node) }))
      .filter(({ node, status }) => {
        const matchesQuery = !normalizedQuery || [node.category.name, ...node.children.map(child => child.name)]
          .some(name => name.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
        const matchesFilter = filter === 'all'
          || (filter === 'attention' && status.attention)
          || (filter === 'monitored' && status.monitored)
          || (filter === 'unconfigured' && !status.monitored);
        return matchesQuery && matchesFilter;
      })
      .sort((a, b) => {
        const priorityA = a.status.maxRatio >= 1 ? 3 : a.status.attention ? 2 : a.status.monitored ? 1 : 0;
        const priorityB = b.status.maxRatio >= 1 ? 3 : b.status.attention ? 2 : b.status.monitored ? 1 : 0;
        return priorityB - priorityA || a.node.category.name.localeCompare(b.node.category.name, 'pt-BR');
      })
      .map(({ node }) => node);
  }, [filter, query, tree]);

  const clearFilters = () => {
    setQuery('');
    setFilter('all');
  };

  if (authLoading) return <PageLoadingSkeleton title="Carregando orçamento" />;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 overflow-auto bg-background">
            <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-32 space-y-7 sm:space-y-8">
              <MonthSelector />
              <PageHeader
                eyebrow="Planejamento"
                title="Orçamento"
                description={`Defina limites independentes por categoria e acompanhe os gastos de ${monthLabel}.`}
              />

              <BudgetSummaryCards
                totalAllocated={totalAllocated}
                monitoredSpent={monitoredSpent}
                monitoredCount={monitoredCount}
                exceededCount={exceededCount}
              />

              {!isOnline && <OfflineBanner />}

              {error && (
                <StatePanel
                  tone={isOnline ? 'error' : 'offline'}
                  icon={<TriangleAlert className="h-5 w-5" />}
                  title={isOnline ? 'Não foi possível carregar o orçamento' : 'Orçamento indisponível offline'}
                  description={isOnline ? 'Os valores não foram atualizados. Verifique a conexão e tente novamente.' : 'Reconecte-se para atualizar os valores do orçamento.'}
                  actionLabel="Tentar novamente"
                  onAction={refetch}
                  className="min-h-0 rounded-3xl py-6"
                />
              )}

              <section className="space-y-4" aria-labelledby="budget-list-title">
                <div>
                  <h2 id="budget-list-title" className="type-title-2">Orçamento por categoria</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Categorias mais próximas do orçamento definido aparecem primeiro.</p>
                </div>

                <div className="surface-base space-y-3 rounded-3xl p-3 sm:p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder="Buscar categoria"
                      aria-label="Buscar categoria"
                      className="h-12 rounded-full pl-11"
                    />
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Filtrar orçamento">
                    <span className="flex size-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground" aria-hidden="true">
                      <SlidersHorizontal className="h-4 w-4" />
                    </span>
                    {([
                      ['all', 'Todos'],
                      ['attention', 'Exigem atenção'],
                      ['monitored', 'Monitoradas'],
                      ['unconfigured', 'Sem orçamento'],
                    ] as const).map(([value, label]) => (
                      <Button
                        key={value}
                        type="button"
                        variant={filter === value ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={filter === value}
                        onClick={() => setFilter(value)}
                        className="shrink-0"
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="space-y-3" role="status" aria-label="Carregando categorias do orçamento">
                    {[0, 1, 2, 3].map(item => <Skeleton key={item} className="h-24 rounded-2xl" />)}
                    <span className="sr-only">Carregando categorias do orçamento</span>
                  </div>
                ) : tree.length === 0 ? (
                  <StatePanel
                    title="Nenhuma categoria cadastrada"
                    description="Adicione categorias nas configurações para começar a definir seu orçamento."
                  />
                ) : visibleTree.length === 0 ? (
                  <StatePanel
                    icon={<Search className="h-5 w-5" />}
                    title="Nenhum orçamento encontrado"
                    description="Altere a busca ou remova o filtro para visualizar outras categorias."
                    actionLabel="Limpar filtros"
                    onAction={clearFilters}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                    {visibleTree.map(node => (
                      <BudgetCategoryRow key={node.category.id} node={node} saveBudget={saveBudget} savingId={savingId} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
