import React, { useState, useRef } from "react";
import { Search, ChevronDown, Pencil } from "lucide-react";
import { useCluster } from "../context/ClusterContext";

interface DomainTypeAheadProps {
  onSelect?: (uniqueHash: string) => void;
}

const DomainTypeAhead: React.FC<DomainTypeAheadProps> = ({ onSelect }) => {
  const { instances, loading, selectedInstance, setSelectedInstance } =
    useCluster();
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSelect = (instance: typeof selectedInstance) => {
    if (!instance) return;
    setSelectedInstance(instance);
    setSearchTerm("");
    setOpen(false);
    onSelect?.(instance.unique_hash);
  };

  const filteredInstances = instances.filter((instance) =>
    instance.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="flex items-center gap-3" ref={dropdownRef}>
      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Select a Cluster:
      </span>
      <div className="relative w-72">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center justify-between w-full border rounded-lg bg-white px-3 py-2 shadow-sm"
        >
          {selectedInstance ? (
            <>
              <span className="truncate">
                {selectedInstance.client_name} | {selectedInstance.name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Pencil className="w-3.5 h-3.5 text-gray-400" />
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </div>
            </>
          ) : (
            <>
              <span className="text-gray-400">Select instance...</span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </>
          )}
        </button>

        {open && (
          <div className="absolute w-full bg-white border rounded-lg mt-1 shadow-lg z-10">
            <div className="relative p-2 border-b">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search instance..."
                className="w-full pl-9 pr-2 py-1 border rounded-md focus:outline-none text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>

            <div className="max-h-48 overflow-y-auto">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainTypeAhead;
