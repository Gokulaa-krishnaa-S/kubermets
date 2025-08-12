import React, { useEffect, useState } from "react";
import ClusterService from "@/services/ClusterService";
import { Search, Server } from "lucide-react";
import { Input } from "../ui/input";

interface Instance {
  id: number;
  name: string;
  client_name: string;
  unique_hash: string;
}

interface DomainTypeAheadProps {
  onSelect: (uniqueHash: string) => void;
}

const DomainTypeAhead: React.FC<DomainTypeAheadProps> = ({ onSelect }) => {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<Instance | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const data = await ClusterService.getInstanceList();
        if (data?.instances?.length) {
          setInstances(data.instances);
          setSelected(data.instances[0]);
          onSelect(data.instances[0].unique_hash);
        }
      } catch (error) {
        console.error("Error fetching instances:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, []);

  const handleSelect = (instance: Instance) => {
    setSelected(instance);
    setSearchTerm("");
    setShowSuggestions(false);
    onSelect(instance.unique_hash);
  };

  const filteredInstances = instances.filter((instance) =>
    instance.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="flex items-start gap-4 w-full relative">
      {/* Current Cluster Card */}
      <div className="flex-shrink-0 items-center rounded-xl  border px-4 py-2 m-2">
        <div className="flex items-center text-center justify-center gap-2 ">
          <Server className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Current Cluster
          </h3>
          {selected ? (
            <div>
              <span className="text-base font-bold text-gray-900 truncate">
                {selected.name} || {selected.client_name}
              </span>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No instance selected</p>
          )}
        </div>
      </div>

      {/* Search Input with Typeahead */}
      <div className="flex-1 relative my-auto">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search instance..."
          className="w-64 pl-10 bg-background"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />

        {/* Suggestions Dropdown */}
        {showSuggestions && searchTerm && (
          <div className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto z-10">
            {filteredInstances.length > 0 ? (
              filteredInstances.map((instance) => (
                <div
                  key={instance.id}
                  onClick={() => handleSelect(instance)}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                >
                  {instance.name}{" "}
                  <span className="text-gray-500">
                    | {instance.client_name}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-gray-500 text-sm">
                No matches found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainTypeAhead;
