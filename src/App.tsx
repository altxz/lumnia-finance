import { Suspense } from "react";
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
import { AnimatedRoutes } from "@/components/AnimatedRoute";
import { lazyWithRetry } from "@/lib/lazyWithRetry";

// Lazy load all route pages
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const AuthPage = lazyWithRetry(() => import("./pages/AuthPage"));
const CategoriesPage = lazyWithRetry(() => import("./pages/CategoriesPage"));
const CategoryDetailsPage = lazyWithRetry(() => import("./pages/CategoryDetailsPage"));
const HistoryPage = lazyWithRetry(() => import("./pages/HistoryPage"));
const SettingsPage = lazyWithRetry(() => import("./pages/SettingsPage"));
const AnalyticsPage = lazyWithRetry(() => import("./pages/AnalyticsPage"));
const WalletPage = lazyWithRetry(() => import("./pages/WalletPage"));
const BudgetPage = lazyWithRetry(() => import("./pages/BudgetPage"));
const ProjectsPage = lazyWithRetry(() => import("./pages/ProjectsPage"));
const DebtSimulatorPage = lazyWithRetry(() => import("./pages/DebtSimulatorPage"));

const ChangelogPage = lazyWithRetry(() => import("./pages/ChangelogPage"));
const OAuthConsentPage = lazyWithRetry(() => import("./pages/OAuthConsentPage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,        // 30 s — dados ficam frescos pouco tempo
      gcTime: 1000 * 60 * 10,      // mantém em memória 10 min
      refetchOnWindowFocus: true,  // ao voltar para a aba, revalida
      refetchOnReconnect: true,    // ao reconectar internet, revalida
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
                  <AnimatedRoutes>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/auth" element={<AuthPage />} />
                      <Route path="/categorias" element={<CategoriesPage />} />
                      <Route path="/categorias/:id" element={<CategoryDetailsPage />} />
                      <Route path="/historico" element={<HistoryPage />} />
                      <Route path="/configuracoes" element={<SettingsPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/wallet" element={<WalletPage />} />
                      <Route path="/orcamento" element={<BudgetPage />} />
                      <Route path="/projetos" element={<ProjectsPage />} />
                      <Route path="/simulador-dividas" element={<DebtSimulatorPage />} />
                      
                      <Route path="/novidades" element={<ChangelogPage />} />
                      <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AnimatedRoutes>
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
