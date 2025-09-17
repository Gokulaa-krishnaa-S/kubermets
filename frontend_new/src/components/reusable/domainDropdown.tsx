import React, { useEffect, useState } from "react";
import ClusterService from "@/services/ClusterService";
import { useCluster } from "../context/ClusterContext";



interface Instance {
  id: number;
  name: string;
  client_name: string;
  unique_hash: string;
}

interface DomainDropdownProps {
  onSelect: (uniqueHash: string) => void;
}

const DomainDropdown: React.FC<DomainDropdownProps> = ({ onSelect }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
    const { selectedInstance,userId}: any = useCluster();


  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const data = await ClusterService.getInstanceList(userId);
        if (data?.instances?.length) {
          setInstances(data.instances);
          const firstHash = data.instances[0].unique_hash;
          setSelected(firstHash);
          onSelect(firstHash);
        }
      } catch (error) {
        console.error("Error fetching instances:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const hash = event.target.value;
    setSelected(hash);
    onSelect(hash);
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <select
      value={selected}
      onChange={handleChange}
      className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {instances.map((instance) => (
        <option key={instance.id} value={instance.unique_hash}>
          {`${instance.name} | ${instance.client_name}`}
        </option>
      ))}
    </select>
  );
};

export default DomainDropdown;
