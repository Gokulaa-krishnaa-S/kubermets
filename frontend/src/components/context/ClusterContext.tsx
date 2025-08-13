// src/context/ClusterContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import ClusterService from "@/services/ClusterService";

interface Instance {
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

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const data = await ClusterService.getInstanceList();
        if (data?.instances?.length) {
          setInstances(data.instances);
          setSelectedInstance(data.instances[0]); // default select first
        }
      } catch (error) {
        console.error("Error fetching instances:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, []);

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
