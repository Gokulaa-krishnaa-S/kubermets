// src/context/ClusterContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useSearchParams } from "react-router-dom";
import ClusterService from "@/services/ClusterService";

interface Instance {
  cluster_id: unknown;
  id: number;
  name: string;
  client_name: string;
  unique_hash: string;
}

interface ClusterContextType {
  instances: Instance[];
  loading: boolean;
  selectedInstance: Instance | null;
  setSelectedInstance: (instance: Instance) => void;
  backendError?: string | null;
  userId?: string | null;
  refreshData: () => void;
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export const ClusterProvider = ({ children }: { children: ReactNode }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const queryClusterId = searchParams.get("cluster_id");

  const getTokenFromCookie = (): string | null => {
    const getCookie = (name: string): string | null => {
      if (typeof document === "undefined") return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return decodeURIComponent(parts.pop()?.split(";").shift() || "");
      }
      return null;
    };


    return (
      getCookie("token") || 
      getCookie("auth_token") || 
      getCookie("keycloak_token") ||
      getCookie("access_token")
    );
  };

  const verifyToken = async (token: string): Promise<string | null> => {
    try {
      const verify_url = import.meta.env.VITE_API_VERIFY_URL;
      const response = await fetch(
        `${verify_url}/api/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Token verified successfully:", result);
        return result.user_id;
      } else {
        const errorText = await response.text();
        console.error("Token verification failed:", response.status, errorText);
        
        if (response.status === 401) {
          setBackendError("Authentication expired. Please login again.");
        } else {
          setBackendError("Authentication failed. Please login again.");
        }
        return null;
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      setBackendError("Network error during authentication. Please check your connection.");
      return null;
    }
  };

  const fetchInstances = async (userId: string) => {
    try {
      setBackendError(null); 
      const data = await ClusterService.getInstanceList(userId);

      console.log("Fetched instances:", data);
      const instanceList = data || [];
      setInstances(instanceList);


      if (instanceList.length > 0) {
        const matched = queryClusterId && 
          instanceList.find((inst) => String(inst.id) === queryClusterId);

        setSelectedInstance(
          matched || selectedInstance || instanceList[0]
        );
      } else {
        setSelectedInstance(null);
      }
    } catch (error) {
      console.error("Error fetching instances:", error);
      const errorMessage = (error as any)?.message || "Failed to load cluster data.";
      setBackendError(errorMessage);
      setInstances([]);
      setSelectedInstance(null);
    }
  };

  const refreshData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    await fetchInstances(userId);
    setLoading(false);
  }, [userId, queryClusterId]);

  const initializeAuth = async () => {
    try {
      console.log("Initializing authentication...");
      setLoading(true);
      setBackendError(null);

      const token = getTokenFromCookie();
      console.log("Token found:", !!token);

      if (!token) {
        setBackendError("No authentication token found. Please login.");
        setUserId(null);
        return;
      }

      const userIdFromToken = await verifyToken(token);
      console.log("User ID from verification:", userIdFromToken);

      if (userIdFromToken) {
        setUserId(userIdFromToken);
        await fetchInstances(userIdFromToken);
      } else {
        setUserId(null);
        setInstances([]);
        setSelectedInstance(null);
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      setBackendError("Failed to initialize authentication.");
      setUserId(null);
      setInstances([]);
      setSelectedInstance(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeAuth();
  }, []);


  useEffect(() => {
    if (userId && instances.length > 0 && queryClusterId) {
      const matched = instances.find((inst) => String(inst.id) === queryClusterId);
      if (matched && matched !== selectedInstance) {
        setSelectedInstance(matched);
      }
    }
  }, [queryClusterId, instances, userId]);

  return (
    <ClusterContext.Provider
      value={{
        instances,
        loading,
        selectedInstance,
        setSelectedInstance,
        backendError,
        userId,
        refreshData,
      }}
    >
      {children}
    </ClusterContext.Provider>
  );
};

export const useCluster = () => {
  const context = useContext(ClusterContext);
  if (!context) {
    throw new Error("useCluster must be used within a ClusterProvider");
  }
  return context;
};