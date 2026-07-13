import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../hooks/useAuthStore';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

const ProtectedRoute: React.FC<Props> = ({ children, roles }) => {
  const { profile, loading } = useAuthStore();
  const user = profile; // unified: user === profile in the MySQL-based auth

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/catalog" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
