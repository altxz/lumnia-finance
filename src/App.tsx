import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DateProvider } from "@/contexts/DateContext";
import { UserSettingsProvider } from "@/contexts/UserSettingsContext";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import Dashboard from "./pages/Dashboard";
import AuthPage from "./pages/AuthPage";
import CategoriesPage from "./pages/CategoriesPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import WalletPage from "./pages/WalletPage";
import BudgetPage from "./pages/BudgetPage";
import ProjectsPage from "./pages/ProjectsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <DateProvider>
          <UserSettingsProvider>
            <BrowserRouter>
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
                <Route path="*" element={<NotFound />} />
              </Routes>
              <FloatingActionButton />
            </BrowserRouter>
          </UserSettingsProvider>
        </DateProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
