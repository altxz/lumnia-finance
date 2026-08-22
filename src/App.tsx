import { Suspense } from "react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, persistOptions } from "@/lib/queryClient";
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
const InvestmentsPage = lazyWithRetry(() => import("./pages/InvestmentsPage"));

const OAuthConsentPage = lazyWithRetry(() => import("./pages/OAuthConsentPage"));
const ForceUpdatePage = lazyWithRetry(() => import("./pages/ForceUpdatePage"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));



function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <span className="text-muted-foreground font-medium animate-pulse">Carregando...</span>
    </div>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
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
                      <Route path="/investimentos" element={<InvestmentsPage />} />
                      
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
    </PersistQueryClientProvider>
  </ThemeProvider>
);

export default App;
