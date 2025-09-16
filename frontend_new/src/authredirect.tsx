import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCluster } from "./components/context/ClusterContext";

export function AuthRedirectWrapper({ children }: { children: React.ReactNode }) {
  const { userId, loading, backendError } = useCluster();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;


    if (backendError && backendError.includes("No authentication token")) {

      console.log("No authentication token, should redirect to login");
      return;
    }

    if (userId && location.pathname === "/environment-ingress") {
      navigate("/environment-ingress/overview", { replace: true });
    }
  }, [loading, userId, backendError, navigate, location.pathname]);

  // Show loading state while authenticating
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Authenticating...</p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (backendError && backendError.includes("No authentication token")) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-red-800 font-semibold mb-2">Authentication Required</h2>
          <p className="text-red-600 mb-4">{backendError}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}