import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DateProvider } from "@/contexts/DateContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { AuthenticatedExtras } from "@/components/AuthenticatedExtras";

// Lazy load all route pages
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const CategoriesPage = lazy(() => import("./pages/CategoriesPage"));
const HistoryPage = lazy(() => import("./pages/HistoryPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const WalletPage = lazy(() => import("./pages/WalletPage"));
const BudgetPage = lazy(() => import("./pages/BudgetPage"));
const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const DebtSimulatorPage = lazy(() => import("./pages/DebtSimulatorPage"));
const FinancialScorePage = lazy(() => import("./pages/FinancialScorePage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min before refetch
      gcTime: 1000 * 60 * 10,   // keep cache 10 min
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-muted-foreground font-medium animate-pulse">Carregando...</span>
    </div>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <DateProvider>
            <UserSettingsProvider>
              <BrowserRouter>
                <Suspense fallback={<PageFallback />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/categorias" element={<CategoriesPage />} />
                    <Route path="/historico" element={<HistoryPage />} />
                    <Route path="/configuracoes" element={<SettingsPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/wallet" element={<WalletPage />} />
                    <Route path="/orcamento" element={<BudgetPage />} />
                    <Route path="/projetos" element={<ProjectsPage />} />
                    <Route path="/simulador-dividas" element={<DebtSimulatorPage />} />
                    <Route path="/score-financeiro" element={<FinancialScorePage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <AuthenticatedExtras />
              </BrowserRouter>
            </UserSettingsProvider>
          </DateProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
