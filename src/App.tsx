import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/auth/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import BooksPage from './pages/admin/BooksPage';
import LoansPage from './pages/admin/LoansPage';
import StudentDashboard from './pages/student/StudentDashboard';
import CatalogPage from './pages/student/CatalogPage';
import UsersPage from './pages/admin/UsersPage';
import SettingsPage from './pages/admin/SettingsPage';
import StatsPage from './pages/admin/StatsPage';
import ResearchPage from './pages/ResearchPage';
import ReservasPage from './pages/student/ReservasPage';
import { useAuthStore } from './hooks/useAuthStore';

const queryClient = new QueryClient();

function AppRoutes() {
  const initialize = useAuthStore((s) => s.initialize);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  const defaultRoute = profile?.role === 'admin' ? '/dashboard' : '/catalog';

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={defaultRoute} replace />} />
        <Route path="dashboard" element={
          <ProtectedRoute roles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="books" element={
          <ProtectedRoute roles={['admin']}>
            <BooksPage />
          </ProtectedRoute>
        } />
        <Route path="loans" element={
          <ProtectedRoute roles={['admin']}>
            <LoansPage />
          </ProtectedRoute>
        } />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="research" element={<ResearchPage />} />
        <Route path="student" element={<StudentDashboard />} />
        <Route path="reservas" element={<ReservasPage />} />
        <Route path="users" element={
          <ProtectedRoute roles={['admin']}>
            <UsersPage />
          </ProtectedRoute>
        } />
        <Route path="settings" element={
          <ProtectedRoute roles={['admin']}>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="stats" element={
          <ProtectedRoute roles={['admin']}>
            <StatsPage />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppRoutes />
        <Toaster position="top-right" />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
