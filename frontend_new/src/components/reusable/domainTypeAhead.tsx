import React, { useState, useRef } from "react";
import { Search, ChevronDown, Pencil } from "lucide-react";
import { useCluster } from "../context/ClusterContext";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  Cloud,
  CloudCog,
  CloudSun,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Server,
  Database,
} from "lucide-react";
import { json } from "stream/consumers";

interface DomainTypeAheadProps {
  onSelect?: (uniqueHash: string) => void;
}

const DomainTypeAhead: React.FC<DomainTypeAheadProps> = ({ onSelect }) => {
  const location = useLocation();

  const { instances, loading, selectedInstance, setSelectedInstance }: any =
    useCluster();
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  // Close dropdown on outside click
  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const providers = [
    {
      value: "AWS",
      label: "AWS",
      icon: <CloudCog className="w-5 h-5 text-orange-500" />,
    },
    {
      value: "Azure",
      label: "Azure",
      icon: <Cloud className="w-5 h-5 text-blue-500" />,
    },
    {
      value: "GCP",
      label: "Google Cloud Platform",
      icon: <CloudSun className="w-5 h-5 text-yellow-500" />,
    },
    {
      value: "Cloudflare",
      label: "Cloudflare",
      icon: <CloudLightning className="w-5 h-5 text-orange-400" />,
    },
    {
      value: "IBM Cloud",
      label: "IBM Cloud",
      icon: <CloudRain className="w-5 h-5 text-blue-400" />,
    },
    {
      value: "Oracle Cloud",
      label: "Oracle Cloud",
      icon: <Server className="w-5 h-5 text-red-500" />,
    },
    {
      value: "DigitalOcean",
      label: "DigitalOcean",
      icon: <Cloud className="w-5 h-5 text-sky-500" />,
    },
    {
      value: "Linode",
      label: "Linode",
      icon: <Database className="w-5 h-5 text-green-500" />,
    },
    {
      value: "SIFY",
      label: "SIFY",
      icon: <CloudSnow className="w-5 h-5 text-blue-300" />,
    },
  ];

  const getProviderIcon = (clientName: string) => {
    const provider = providers.find(
      (p) => p?.value?.toLowerCase() === clientName?.toLowerCase()
    );
    return provider?.icon || <Server className="w-5 h-5 text-gray-500" />;
  };

  const getSelectedProviderIcon = () => {
    if (!selectedInstance) return null;
    return getProviderIcon(selectedInstance.client_name);
  };

  const handleSelect = (instance: typeof selectedInstance) => {
    if (!instance) return;
    setSelectedInstance(instance);
    setSearchTerm("");
    setOpen(false);
    console.log(instance);
    // 🔑 update query param when cluster changes
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("cluster_id", String(instance.id));
      return newParams;
    });

    onSelect?.(instance.id);
  };

  const filteredInstances = instances.filter((instance: any) =>
    instance?.clusterName?.toLowerCase().includes(searchTerm.toLowerCase())
  );


  // Hide dropdown on overview and cluster creation pages
  const hideOnRoutes = ["/overview", "/cluster-creation", "/pages/overview", "/pages/cluster-creation", "/cluster-creation/gcp", "/pages/cluster-creation/gcp"];
  if (hideOnRoutes.some((route) => location.pathname.startsWith(route))) {
    return null;
  }
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
              <div className="flex items-center gap-2 truncate">
                {getSelectedProviderIcon()}
                <span className="truncate">
                  {selectedInstance?.clusterName} {"_"}
                  {selectedInstance?.id}
                </span>
              </div>
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
                    className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getProviderIcon(instance?.client_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">
                        {instance?.clusterName}
                        {"_"}
                        {instance?.id}
                      </span>
                    </div>
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
