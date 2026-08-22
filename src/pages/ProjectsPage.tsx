import { useState, useEffect, useCallback, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PlusCircle, Trash2, FolderKanban, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate, getCategoryLabel } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  user_id: string;
  name: string;
  budget: number | null;
  color: string;
  created_at: string;
}

interface ProjectExpense {
  id: string;
  description: string;
  value: number;
  date: string;
  final_category: string;
  type: string;
}

const COLOR_OPTIONS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function ProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', budget: '', color: '#6366f1' });

  // Sheet state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [projectExpenses, setProjectExpenses] = useState<ProjectExpense[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  // Spending per project
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: projectsData }, { data: expData }] = await Promise.all([
      supabase.from('projects').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('expenses').select('project_id, value, type').eq('user_id', user.id).not('project_id', 'is', null),
    ]);
    setProjects((projectsData || []) as Project[]);

    const map: Record<string, number> = {};
    (expData || []).forEach((e: any) => {
      if (e.project_id && e.type !== 'income' && e.type !== 'transfer') {
        map[e.project_id] = (map[e.project_id] || 0) + e.value;
      }
    });
    setSpentMap(map);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const fetchProjectExpenses = useCallback(async (projectId: string) => {
    if (!user) return;
    setSheetLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('id, description, value, date, final_category, type')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .order('date', { ascending: false })
      .limit(100);
    setProjectExpenses((data || []) as ProjectExpense[]);
    setSheetLoading(false);
  }, [user]);

  const handleOpenProject = (project: Project) => {
    setSelectedProject(project);
    setSheetOpen(true);
    fetchProjectExpenses(project.id);
  };

  const handleAddProject = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Erro', description: 'Preencha o nome do projeto.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('projects').insert({
      user_id: user?.id,
      name: form.name.trim(),
      budget: form.budget ? parseFloat(form.budget) : null,
      color: form.color,
    });
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Projeto criado!' });
      setForm({ name: '', budget: '', color: '#6366f1' });
      setModalOpen(false);
      fetchProjects();
    }
    setSaving(false);
  };

  const handleDeleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Projeto removido' }); fetchProjects(); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><span className="text-muted-foreground">Carregando...</span></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <DashboardHeader />
          <main className="flex-1 p-3 sm:p-4 lg:p-8 pb-32 space-y-4 sm:space-y-6 overflow-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projetos</h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Centros de custo para organizar as tuas despesas</p>
              </div>
              <Button onClick={() => setModalOpen(true)} className="gap-2 rounded-xl h-11 px-6 bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <PlusCircle className="h-5 w-5" /> Novo Projeto
              </Button>
            </div>

            {loading ? (
              <p className="text-muted-foreground text-center py-12">Carregando...</p>
            ) : projects.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nenhum projeto criado</p>
                  <p className="text-sm mt-1">Cria projetos para agrupar despesas por viagem, evento ou objetivo.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map(project => {
                  const spent = spentMap[project.id] || 0;
                  const hasBudget = project.budget !== null && project.budget > 0;
                  const pct = hasBudget ? Math.min((spent / project.budget!) * 100, 100) : 0;
                  const overBudget = hasBudget && spent > project.budget!;
                  const nearBudget = hasBudget && pct >= 80 && !overBudget;

                  return (
                    <Card
                      key={project.id}
                      className="rounded-2xl hover:shadow-card transition-shadow cursor-pointer"
                      onClick={() => handleOpenProject(project)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                            <p className="font-semibold truncate text-lg">{project.name}</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive rounded-xl" onClick={e => e.stopPropagation()}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl" onClick={e => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover projeto?</AlertDialogTitle>
                                <AlertDialogDescription>As transações vinculadas não serão apagadas, apenas desvinculadas.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm text-muted-foreground">Gasto</span>
                            <span className="text-xl font-bold">{formatCurrency(spent)}</span>
                          </div>
                          {hasBudget && (
                            <>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Orçamento: {formatCurrency(project.budget!)}</span>
                                <span className="flex items-center gap-1">
                                  {overBudget && <AlertTriangle className="h-3 w-3 text-destructive" />}
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <Progress
                                value={pct}
                                className={`h-2 ${overBudget ? '[&>div]:bg-destructive' : nearBudget ? '[&>div]:bg-orange-500' : ''}`}
                              />
                              {overBudget && (
                                <p className="text-xs text-destructive font-medium">
                                  Ultrapassou em {formatCurrency(spent - project.budget!)}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add Project Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Novo Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do projeto</Label>
              <Input placeholder="Ex: Viagem a Lisboa, Reforma da casa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Orçamento (opcional)</Label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleAddProject} disabled={saving} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
              {saving ? 'Salvando...' : 'Criar Projeto'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedProject && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full shrink-0" style={{ backgroundColor: selectedProject.color }} />
                  <SheetTitle className="text-xl">{selectedProject.name}</SheetTitle>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-2 p-4 rounded-xl bg-muted">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total gasto</span>
                  <span className="font-bold">{formatCurrency(spentMap[selectedProject.id] || 0)}</span>
                </div>
                {selectedProject.budget !== null && selectedProject.budget > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Orçamento</span>
                    <span className="font-semibold">{formatCurrency(selectedProject.budget)}</span>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-sm mb-3">Transações</h3>
                {sheetLoading ? (
                  <p className="text-muted-foreground text-center py-8">Carregando...</p>
                ) : projectExpenses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8 text-sm">Nenhuma transação vinculada.</p>
                ) : (
                  <div className="space-y-2">
                    {projectExpenses.map(exp => {
                      const catLabel = getCategoryLabel(exp.final_category);
                      return (
                        <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl border">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{exp.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(exp.date)} · {catLabel}</p>
                          </div>
                          <span className={`font-semibold text-sm shrink-0 ml-3 ${exp.type === 'income' ? 'text-emerald-500' : 'text-destructive'}`}>
                            {exp.type === 'income' ? '+' : '-'}{formatCurrency(exp.value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
