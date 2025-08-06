import React from "react";
import { X, Cpu, Server, HardDrive, Clock, DollarSign } from "lucide-react";

const PodDetailsModal = ({
  isOpen = false,
  onClose,
  selectedPod = "",
  podDetails = [],
  isLoading = false,
  formatCurrency,
  // Optional customization props
  maxWidth = "max-w-6xl",
  backdropBlur = "backdrop-blur-sm",
  backdropOpacity = "bg-black/50",
  borderRadius = "rounded-xl",
  showResourceDistribution = true,
  showPerformanceMetrics = true,
  customTitle = null,
  loadingText = "Loading container data...",
  // Theme customization
  theme = {
    primary: "blue",
    success: "green",
    warning: "amber",
    accent: "purple",
  },
}) => {
  // Handle escape key press
  React.useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Don't render if not open
  if (!isOpen) return null;

  // Calculate totals
  const totalCost = podDetails.reduce(
    (sum, container) => sum + parseFloat(container.totalCost || 0),
    0
  );
  const totalCpuCost = podDetails.reduce(
    (sum, container) => sum + parseFloat(container.cpu?.cost || 0),
    0
  );
  const totalRamCost = podDetails.reduce(
    (sum, container) => sum + parseFloat(container.ram?.cost || 0),
    0
  );
  const totalStorageCost = podDetails.reduce(
    (sum, container) => sum + parseFloat(container.pv?.cost || 0),
    0
  );
  const maxHours =
    podDetails.length > 0
      ? Math.max(...podDetails.map((c) => parseFloat(c.totalHours || 0)))
      : 0;
  const maxContainerCost =
    podDetails.length > 0
      ? Math.max(...podDetails.map((c) => parseFloat(c.totalCost || 0)))
      : 0;

  // Theme color mappings
  const themeColors = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-600",
      gradient: "from-blue-50 to-blue-100",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-600",
      gradient: "from-green-50 to-green-100",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-600",
      gradient: "from-amber-50 to-amber-100",
    },
    purple: {
      bg: "bg-purple-50",
      border: "border-purple-200",
      text: "text-purple-600",
      gradient: "from-purple-50 to-purple-100",
    },
  };

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop with blur effect */}
      <div
        className={`absolute inset-0 ${backdropOpacity} ${backdropBlur} transition-opacity duration-300`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-2 sm:p-4">
        <div
          className={`relative w-full ${maxWidth} bg-white ${borderRadius} shadow-2xl ring-1 ring-black/5 overflow-hidden transform transition-all duration-300 scale-100`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
            <h3
              id="modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              {customTitle || `Details for ${selectedPod}`}
            </h3>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div
                    className={`animate-spin rounded-full h-10 w-10 border-2 border-${theme.primary}-600 border-t-transparent mb-4`}
                  ></div>
                  <p className="text-gray-600">{loadingText}</p>
                </div>
              ) : podDetails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <p className="text-gray-600">No container data available</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column - Resource Overview and Container Details */}
                  <div className="space-y-6">
                    {/* Resource Overview */}
                    <div
                      className={`bg-gradient-to-br ${
                        themeColors[theme.primary].gradient
                      } rounded-xl p-5 ${
                        themeColors[theme.primary].border
                      } border`}
                    >
                      <h4
                        className={`font-semibold text-${theme.primary}-900 mb-4 text-lg`}
                      >
                        {selectedPod}
                      </h4>
                      {podDetails.map((container, index) => (
                        <div key={index} className="mb-5 last:mb-0">
                          <h5
                            className={`font-medium text-${theme.primary}-800 mb-3 text-base`}
                          >
                            {container.containerName}
                          </h5>
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                              <Cpu
                                className={`w-4 h-4 text-${theme.primary}-600 flex-shrink-0`}
                              />
                              <span
                                className={`text-${theme.primary}-700 truncate`}
                              >
                                CPU: {container.cpu?.amount} cores (
                                {formatCurrency(
                                  parseFloat(container.cpu?.cost || 0)
                                )}
                                )
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                              <Server
                                className={`w-4 h-4 text-${theme.primary}-600 flex-shrink-0`}
                              />
                              <span
                                className={`text-${theme.primary}-700 truncate`}
                              >
                                RAM: {container.ram?.amount} GiB (
                                {formatCurrency(
                                  parseFloat(container.ram?.cost || 0)
                                )}
                                )
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                              <HardDrive
                                className={`w-4 h-4 text-${theme.primary}-600 flex-shrink-0`}
                              />
                              <span
                                className={`text-${theme.primary}-700 truncate`}
                              >
                                PV: {container.pv?.amount} GiB (
                                {formatCurrency(
                                  parseFloat(container.pv?.cost || 0)
                                )}
                                )
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/60 rounded-lg p-2">
                              <Clock
                                className={`w-4 h-4 text-${theme.primary}-600 flex-shrink-0`}
                              />
                              <span
                                className={`text-${theme.primary}-700 truncate`}
                              >
                                Time: {container.totalHours} hours
                              </span>
                            </div>
                          </div>
                          {index < podDetails.length - 1 && (
                            <div
                              className={`border-t border-${theme.primary}-300/50 mt-4 pt-3`}
                            >
                              <div className="flex items-center gap-2 bg-white/80 rounded-lg p-2">
                                <DollarSign
                                  className={`w-4 h-4 text-${theme.primary}-600`}
                                />
                                <span
                                  className={`font-semibold text-${theme.primary}-900`}
                                >
                                  Container Cost:{" "}
                                  {formatCurrency(
                                    parseFloat(container.totalCost || 0)
                                  )}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      <div
                        className={`mt-4 pt-4 border-t border-${theme.primary}-300/50`}
                      >
                        <div className="flex items-center gap-2 bg-white/90 rounded-lg p-3">
                          <DollarSign
                            className={`w-5 h-5 text-${theme.primary}-600`}
                          />
                          <span
                            className={`font-bold text-${theme.primary}-900 text-lg`}
                          >
                            Total Pod Cost: {formatCurrency(totalCost)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Container Details */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 text-lg">
                        Container Resource Usage
                      </h4>
                      {podDetails.map((container, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 rounded-xl p-5 border border-gray-200"
                        >
                          <h5 className="font-medium text-gray-800 mb-4 text-base">
                            {container.containerName}
                          </h5>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* CPU Usage */}
                            <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                                  <Cpu
                                    className={`w-4 h-4 text-${theme.primary}-500`}
                                  />
                                  CPU
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  {container.cpu?.hourlyRate}/hr
                                </span>
                              </div>
                              <div className="space-y-1 text-xs text-gray-600">
                                <div>
                                  Allocation:{" "}
                                  <span className="font-medium">
                                    {container.cpu?.amount} cores
                                  </span>
                                </div>
                                <div className="font-semibold text-gray-900 text-sm">
                                  Cost:{" "}
                                  {formatCurrency(
                                    parseFloat(container.cpu?.cost || 0)
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Memory Usage */}
                            <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                                  <Server
                                    className={`w-4 h-4 text-${theme.success}-500`}
                                  />
                                  Memory
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  {container.ram?.hourlyRate}/hr
                                </span>
                              </div>
                              <div className="space-y-1 text-xs text-gray-600">
                                <div>
                                  Allocation:{" "}
                                  <span className="font-medium">
                                    {container.ram?.amount} GiB
                                  </span>
                                </div>
                                <div className="font-semibold text-gray-900 text-sm">
                                  Cost:{" "}
                                  {formatCurrency(
                                    parseFloat(container.ram?.cost || 0)
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Storage and Runtime */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                            {/* Storage Usage */}
                            {parseFloat(container.pv?.cost || 0) > 0 && (
                              <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                                    <HardDrive
                                      className={`w-4 h-4 text-${theme.warning}-500`}
                                    />
                                    Storage
                                  </span>
                                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                    {container.pv?.hourlyRate}/hr
                                  </span>
                                </div>
                                <div className="space-y-1 text-xs text-gray-600">
                                  <div>
                                    Volume:{" "}
                                    <span className="font-medium">
                                      {container.pv?.amount} GiB
                                    </span>
                                  </div>
                                  <div className="font-semibold text-gray-900 text-sm">
                                    Cost:{" "}
                                    {formatCurrency(
                                      parseFloat(container.pv?.cost || 0)
                                    )}
                                  </div>
                                  {container.pv?.adjustment !== 0 && (
                                    <div>
                                      Adj:{" "}
                                      <span className="font-medium">
                                        {formatCurrency(
                                          parseFloat(
                                            container.pv?.adjustment || 0
                                          )
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Runtime */}
                            <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-medium text-gray-700 text-sm flex items-center gap-2">
                                  <Clock
                                    className={`w-4 h-4 text-${theme.accent}-500`}
                                  />
                                  Runtime
                                </span>
                              </div>
                              <div className="space-y-1 text-xs text-gray-600">
                                <div>
                                  Hours:{" "}
                                  <span className="font-medium">
                                    {container.totalHours}
                                  </span>
                                </div>
                                <div className="font-semibold text-gray-900 text-sm">
                                  Total:{" "}
                                  {formatCurrency(
                                    parseFloat(container.totalCost || 0)
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column - Summary */}
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900 text-lg">
                        Pod Summary
                      </h4>
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm bg-white rounded-lg p-2">
                              <span className="text-gray-600">
                                Total Containers:
                              </span>
                              <span className="font-semibold text-gray-900">
                                {podDetails.length}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm bg-white rounded-lg p-2">
                              <span className="text-gray-600">
                                Total CPU Cost:
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(totalCpuCost)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-sm bg-white rounded-lg p-2">
                              <span className="text-gray-600">
                                Total RAM Cost:
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(totalRamCost)}
                              </span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center text-sm bg-white rounded-lg p-2">
                              <span className="text-gray-600">
                                Total Storage:
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formatCurrency(totalStorageCost)}
                              </span>
                            </div>
                            <div
                              className={`bg-white rounded-lg p-3 border-2 border-${theme.primary}-200`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-gray-900">
                                  Total Cost:
                                </span>
                                <span
                                  className={`font-bold text-${theme.primary}-600 text-xl`}
                                >
                                  {formatCurrency(totalCost)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resource Breakdown Chart */}
                    {showResourceDistribution && totalCost > 0 && (
                      <div
                        className={`bg-gradient-to-br from-${theme.primary}-50 via-indigo-50 to-${theme.accent}-50 rounded-xl p-5 border border-${theme.primary}-200`}
                      >
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Resource Distribution
                        </h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div
                            className={`bg-white/80 backdrop-blur rounded-lg p-4 border border-${theme.primary}-100`}
                          >
                            <div
                              className={`text-2xl font-bold text-${theme.primary}-600 mb-1`}
                            >
                              {Math.round((totalCpuCost / totalCost) * 100)}%
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              CPU
                            </div>
                          </div>
                          <div
                            className={`bg-white/80 backdrop-blur rounded-lg p-4 border border-${theme.success}-100`}
                          >
                            <div
                              className={`text-2xl font-bold text-${theme.success}-600 mb-1`}
                            >
                              {Math.round((totalRamCost / totalCost) * 100)}%
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              RAM
                            </div>
                          </div>
                          <div
                            className={`bg-white/80 backdrop-blur rounded-lg p-4 border border-${theme.warning}-100`}
                          >
                            <div
                              className={`text-2xl font-bold text-${theme.warning}-600 mb-1`}
                            >
                              {Math.round((totalStorageCost / totalCost) * 100)}
                              %
                            </div>
                            <div className="text-xs text-gray-600 font-medium">
                              Storage
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Performance Metrics */}
                    {showPerformanceMetrics && (
                      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                        <h4 className="font-semibold text-gray-900 mb-4">
                          Performance Metrics
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">
                              Avg Cost per Hour:
                            </span>
                            <span className="font-semibold text-gray-900">
                              {maxHours > 0
                                ? formatCurrency(totalCost / maxHours)
                                : formatCurrency(0)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">
                              Longest Runtime:
                            </span>
                            <span className="font-semibold text-gray-900">
                              {maxHours} hours
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                            <span className="text-gray-600">
                              Most Expensive Container:
                            </span>
                            <span className="font-semibold text-gray-900">
                              {formatCurrency(maxContainerCost)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PodDetailsModal;
