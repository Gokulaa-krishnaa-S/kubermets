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
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export const ClusterProvider = ({ children }: { children: ReactNode }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(
    null
  );
  const [backendError, setBackendError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const queryClusterId = searchParams.get("cluster_id");

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        // const data = await ClusterService.getInstanceList();
        // checkClusterExists();
        const data = await getInstanceList();
        console.log(data);
        const instanceList = data || [];
        setInstances(instanceList);
        setBackendError(null);
        console.log(
          queryClusterId,
          "-----------------------",
          selectedInstance
        );
        if (instanceList.length > 0) {
          // Try to match cluster_id from query param
          const matched =
            queryClusterId &&
            instanceList.find((inst) => String(inst.id) === queryClusterId);

          setSelectedInstance(
            matched
              ? matched
              : selectedInstance
              ? selectedInstance
              : instanceList[0]
          ); // fallback to first
        }
      } catch (error) {
        console.error("Error fetching instances:", error);
        setBackendError(
          (error as any)?.message || "Failed to connect to backend service."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, [queryClusterId]); // refetch when query param changes
  const getInstanceList = useCallback(async () => {
    try {
      const backendApiBaseUrl =
        import.meta.env.VITE_BACKEND_API_BASE_URL ||
        "http://172.16.10.4:5000/api";
      const response = await fetch(`${backendApiBaseUrl}/clusters`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Cluster found:", result);
        return result.data;
      } else {
        console.error("Cluster not found or error:", response.status);
        return null;
      }
    } catch (error) {
      console.error("Error checking cluster existence:", error);
      return null;
    }
  }, []);
  return (
    <ClusterContext.Provider
      value={{
        instances,
        loading,
        selectedInstance,
        setSelectedInstance,
        backendError,
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
