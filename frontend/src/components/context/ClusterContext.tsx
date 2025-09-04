// src/context/ClusterContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
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
}

const ClusterContext = createContext<ClusterContextType | undefined>(undefined);

export const ClusterProvider = ({ children }: { children: ReactNode }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(
    null
  );

  const [searchParams] = useSearchParams();
  const queryClusterId = searchParams.get("cluster_id");

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const data = await ClusterService.getInstanceList();
        const instanceList = data?.data || [];
        setInstances(instanceList);
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
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, [queryClusterId]); // refetch when query param changes

  return (
    <ClusterContext.Provider
      value={{ instances, loading, selectedInstance, setSelectedInstance }}
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
