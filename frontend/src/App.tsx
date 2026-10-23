import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { AccountsPage } from './pages/AccountsPage';
import { BudgetPage } from './pages/BudgetPage';
import { DashboardPage } from './pages/DashboardPage';
import {
  AccountDetailPage,
  CategoryDetailPage,
  CreditDetailPage,
  EnvelopeDetailPage,
  GoalDetailPage,
} from './pages/DetailPages';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { PlanningPage } from './pages/PlanningPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="skeleton h-10 w-40" />
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/accounts/:id" element={<AccountDetailPage />} />
            <Route path="/envelopes/:id" element={<EnvelopeDetailPage />} />
            <Route path="/categories/:id" element={<CategoryDetailPage />} />
            <Route path="/goals/:id" element={<GoalDetailPage />} />
            <Route path="/credits/:id" element={<CreditDetailPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/debts" element={<Navigate to="/planning?tab=savings" replace />} />
            <Route path="/rewards" element={<Navigate to="/settings" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
