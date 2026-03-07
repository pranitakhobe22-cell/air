import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@/services/auth';

/**
 * Wraps any component/layout and redirects to /login if no JWT token is present.
 * Works with both children and Outlet patterns.
 */
const ProtectedRoute = ({ children }) => {
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
