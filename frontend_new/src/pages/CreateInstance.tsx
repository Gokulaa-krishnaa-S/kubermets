import React, { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import ClusterService from "@/services/ClusterService";
import { Plus, Upload } from "lucide-react";
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
interface InstanceFormData {
  name: string;
  description: string;
  api_url: string;
  client_name: string;
  username: string;
  password: string;
}

interface InstanceFormProps {
  mode: "create" | "edit";
  initialData?: any;
  onBack: () => void;
  onInstanceSaved: () => void;
}
interface ProviderForm {
  name: string;
  logo: string | File;
}
const InstanceForm: React.FC<InstanceFormProps> = ({
  mode,
  initialData,
  onBack,
  onInstanceSaved,
}) => {
  const [formData, setFormData] = useState<InstanceFormData>({
    name: "",
    description: "",
    api_url: "",
    client_name: "",
    username: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
  const [showProviderModal, setShowProviderModal] = useState(false);

  const [newProvider, setNewProvider] = useState<ProviderForm>({
    name: "",
    logo: "",
  });
  // Pre-fill for edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      const { name, description, api_url, client_name, username, password } =
        initialData;
      console.log(client_name, "---------------");
      setFormData({
        name,
        description,
        api_url,
        client_name,
        username,
        password,
      });
    }
  }, [mode, initialData]);

  // const handleAddProvider = async () => {
  //   if (!newProvider.name.trim() || !newProvider.logo) return;

  //   try {
  //     const formData = new FormData();
  //     formData.append("name", newProvider.name);
  //     formData.append("logo", newProvider.logo); // This should be a File object

  //     const created = await ClusterService.createProvider(formData);
  //     setProviders((prev) => [...prev, created]);
  //     setShowProviderModal(false);
  //     setNewProvider({ name: "", logo: "" });
  //   } catch (err) {
  //     console.error("Failed to add provider", err);
  //   }
  // };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError("Instance name is required");
      return false;
    }
    if (!formData.api_url.trim()) {
      setError("API URL is required");
      return false;
    }
    try {
      new URL(formData.api_url);
    } catch {
      setError("Please enter a valid API URL");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);

    try {
      let result;

      if (mode === "create") {
        result = await ClusterService.createInstance(formData);
      } else {
        if (!initialData?.id) {
          throw new Error("Instance ID is missing for update");
        }
        result = await ClusterService.updateInstance(initialData.id, formData);
      }

      setSuccess(true);
      setTimeout(() => {
        onInstanceSaved();
        onBack();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to save instance");
    } finally {
      setLoading(false);
    }
  };
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    setFormData((prev: any) => ({ ...prev, client_name: value }));
    setOpen(false);
  };

  const selectedProvider = providers.find(
    (p) => p.value === formData.client_name
  );
  if (success) {
    return (
      <Layout
        title={mode === "create" ? "Create Cluster" : "Edit Cluster"}
        subtitle={
          mode === "create"
            ? "Create a new Kubernetes instance"
            : "Update Kubernetes instance details"
        }
      >
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-green-800 mb-2">
              {mode === "create"
                ? "Instance Created Successfully!"
                : "Instance Updated Successfully!"}
            </h3>
            <p className="text-green-600">
              Redirecting back to instance list...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-white shadow-lg rounded-xl p-6">
        <div className="flex items-center mb-6">
          <button
            onClick={onBack}
            type="button"
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mr-4"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === "create" ? "Add New Cluster" : "Edit Cluster"}
          </h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* form fields */}
        <div className="space-y-6">
          {/* Instance name & client name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="client_name"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Provider Name
              </label>
              <div className="relative w-full">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onClick={() => setOpen((prev) => !prev)}
                >
                  {selectedProvider ? (
                    <span className="flex items-center gap-2">
                      {selectedProvider.icon}
                      {selectedProvider.label}
                    </span>
                  ) : (
                    <span className="text-gray-500">Select a provider</span>
                  )}
                  <span className="ml-2 text-gray-500">▼</span>
                </button>

                {open && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg">
                    {providers.map((provider) => (
                      <div
                        key={provider.value}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-blue-100 cursor-pointer"
                        onClick={() => handleSelect(provider.value)}
                      >
                        {provider.icon}
                        {provider.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* API URL */}
          <div>
            <label
              htmlFor="api_url"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              API URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              id="api_url"
              name="api_url"
              value={formData.api_url}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Username & Password */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-4 pt-6">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {loading ? (
                "Saving..."
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {mode === "create" ? "Add" : "Update"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* {showProviderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h3 className="text-lg font-semibold mb-4">Add New Provider</h3>

           
            <input
              type="text"
              placeholder="Provider Name"
              value={newProvider.name}
              onChange={(e) =>
                setNewProvider((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full mb-4 px-3 py-2 border border-gray-300 rounded-lg"
            />

    
            <div className="mb-4">
              <label className="block text-sm mb-2">Logo Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setNewProvider((prev) => ({ ...prev, logo: file }));
                  }
                }}
              />
            </div>

          
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowProviderModal(false)}
                className="px-4 py-2 border rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProvider}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default InstanceForm;
