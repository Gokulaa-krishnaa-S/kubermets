import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Gauge } from 'lucide-react';
import { 
  Activity, 
  Server, 
  Cpu, 
  HardDrive, 
  Network, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Settings,
  Eye,
  Users,
  Box,
  Cloud,
  Layers,
  Monitor,
  Wifi,
  Save,
  Bell,
  DollarSign,
  Search,
  Plus
} from 'lucide-react';

const K8sDashboard = () => {
  const [activeView, setActiveView] = useState('cluster');
  const [timeRange, setTimeRange] = useState('24h');

  // Sample data for charts
  const clusterHealthData = [
    { name: 'Healthy', value: 95, color: '#10B981' },
    { name: 'Warning', value: 3, color: '#F59E0B' },
    { name: 'Critical', value: 2, color: '#EF4444' }
  ];

  const nodeStatusData = [
    { name: 'Healthy', count: 12, color: '#10B981' },
    { name: 'Unhealthy', count: 2, color: '#EF4444' },
    { name: 'Unschedulable', count: 1, color: '#6B7280' }
  ];

  const resourceUsageData = [
    { time: '00:00', cpu: 65, memory: 72, disk: 45 },
    { time: '04:00', cpu: 58, memory: 68, disk: 47 },
    { time: '08:00', cpu: 78, memory: 82, disk: 52 },
    { time: '12:00', cpu: 85, memory: 88, disk: 58 },
    { time: '16:00', cpu: 72, memory: 75, disk: 55 },
    { time: '20:00', cpu: 68, memory: 71, disk: 49 }
  ];

  const namespaceData = [
    { name: 'production', cpu: 45, memory: 62, storage: 78, workloads: 24, pods: 156 },
    { name: 'staging', cpu: 32, memory: 48, storage: 45, workloads: 12, pods: 68 },
    { name: 'development', cpu: 28, memory: 35, storage: 32, workloads: 8, pods: 42 },
    { name: 'monitoring', cpu: 15, memory: 25, storage: 68, workloads: 6, pods: 28 }
  ];

  const workloadData = [
    { name: 'web-app', desired: 5, actual: 5, cpu: 65, memory: 72, status: 'Running' },
    { name: 'api-service', desired: 3, actual: 3, cpu: 58, memory: 68, status: 'Running' },
    { name: 'worker-queue', desired: 2, actual: 1, cpu: 45, memory: 52, status: 'Scaling' },
    { name: 'cache-redis', desired: 1, actual: 1, cpu: 25, memory: 38, status: 'Running' }
  ];

  const alertsData = [
    { severity: 'Critical', count: 3, color: '#EF4444' },
    { severity: 'Warning', count: 8, color: '#F59E0B' },
    { severity: 'Info', count: 12, color: '#3B82F6' }
  ];

  const costData = [
    { namespace: 'production', cost: 2450, waste: 15 },
    { namespace: 'staging', cost: 890, waste: 25 },
    { namespace: 'development', cost: 560, waste: 35 },
    { namespace: 'monitoring', cost: 340, waste: 8 }
  ];

  const sidebarItems = [
    { id: 'cluster', label: 'Cluster Overview', icon: Cloud },
    { id: 'namespaces', label: 'Namespaces', icon: Layers },
    { id: 'nodes', label: 'Node Metrics', icon: Server },
    { id: 'workloads', label: 'Workloads', icon: Box },
    { id: 'pods', label: 'Pods & Containers', icon: Activity },
    { id: 'control', label: 'Control Plane', icon: Settings },
    { id: 'networking', label: 'Networking', icon: Wifi },
    { id: 'storage', label: 'Storage', icon: Save },
    { id: 'alerts', label: 'Alerts & Events', icon: Bell },
    { id: 'cost', label: 'Cost & Efficiency', icon: DollarSign }
  ];

  const MetricCard = ({ title, value, subtitle, trend, icon: Icon, color = 'blue' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold text-${color}-600 mt-2`}>{value}</p>
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          {trend && (
            <p className={`text-xs mt-2 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '↗' : '↘'} {Math.abs(trend)}% from yesterday
            </p>
          )}
        </div>
        <div className={`p-3 bg-${color}-100 rounded-lg`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  const renderClusterOverview = () => (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Cluster Health" 
          value="95%" 
          subtitle="All systems operational" 
          trend={2}
          icon={CheckCircle}
          color="green"
        />
        <MetricCard 
          title="Total Nodes" 
          value="15" 
          subtitle="12 healthy, 2 warning, 1 critical" 
          trend={0}
          icon={Server}
          color="blue"
        />
        <MetricCard 
          title="Active Pods" 
          value="342" 
          subtitle="Running across all namespaces" 
          trend={8}
          icon={Activity}
          color="purple"
        />
        <MetricCard 
          title="CPU Usage" 
          value="68%" 
          subtitle="Cluster-wide average" 
          trend={-3}
          icon={Cpu}
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cluster Health Gauge */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cluster Health Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={clusterHealthData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={120}
                dataKey="value"
              >
                {clusterHealthData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Resource Usage Trends */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Usage Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={resourceUsageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="cpu" stroke="#EF4444" strokeWidth={2} name="CPU %" />
              <Line type="monotone" dataKey="memory" stroke="#3B82F6" strokeWidth={2} name="Memory %" />
              <Line type="monotone" dataKey="disk" stroke="#10B981" strokeWidth={2} name="Disk %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Node Status Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Node Status Overview</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={nodeStatusData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3B82F6" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderNamespaces = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard trend={5} title="Total Namespaces"  value="8" subtitle="Active environments" icon={Layers} color="blue" />
        <MetricCard trend={5} title="Production Pods" value="156" subtitle="24 workloads running" icon={Activity} color="green" />
        <MetricCard trend={5} title="CPU Quota Used" value="65%" subtitle="Across all namespaces" icon={Cpu} color="orange" />
        <MetricCard trend={5} title="Memory Quota Used" value="72%" subtitle="Total allocation" icon={Monitor} color="purple" />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Namespace Resource Allocation</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Namespace</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Memory %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Storage %</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workloads</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pods</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {namespaceData.map((ns, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ns.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{width: `${ns.cpu}%`}}></div>
                      </div>
                      {ns.cpu}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{width: `${ns.memory}%`}}></div>
                      </div>
                      {ns.memory}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{width: `${ns.storage}%`}}></div>
                      </div>
                      {ns.storage}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ns.workloads}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ns.pods}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderWorkloads = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard trend={5} title="Total Workloads" value="48" subtitle="Across all namespaces" icon={Box} color="blue" />
        <MetricCard trend={5} title="Running" value="42" subtitle="Healthy deployments" icon={CheckCircle} color="green" />
        <MetricCard trend={5} title="Scaling" value="4" subtitle="Auto-scaling active" icon={Activity} color="orange" />
        <MetricCard trend={5} title="Failed" value="2" subtitle="Requires attention" icon={XCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Replica Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={workloadData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="desired" fill="#3B82F6" name="Desired" />
              <Bar dataKey="actual" fill="#10B981" name="Actual" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Workload Details</h3>
          <div className="space-y-4">
            {workloadData.map((workload, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{workload.name}</h4>
                  <p className="text-sm text-gray-500">CPU: {workload.cpu}% | Memory: {workload.memory}%</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  workload.status === 'Running' ? 'bg-green-100 text-green-800' :
                  workload.status === 'Scaling' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {workload.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard trend={5} title="Critical Alerts" value="3" subtitle="Immediate attention required" icon={AlertTriangle} color="red" />
        <MetricCard trend={5} title="Warnings" value="8" subtitle="Monitor closely" icon={Eye} color="orange" />
        <MetricCard trend={5} title="Info Events" value="12" subtitle="Recent activity" icon={Bell} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={alertsData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                dataKey="count"
              >
                {alertsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 border-l-4 border-red-500 bg-red-50 rounded">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-red-800">Node worker-03 not ready</p>
                <p className="text-xs text-red-600">2 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center p-3 border-l-4 border-orange-500 bg-orange-50 rounded">
              <Eye className="h-5 w-5 text-orange-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-orange-800">High memory usage in production</p>
                <p className="text-xs text-orange-600">15 minutes ago</p>
              </div>
            </div>
            <div className="flex items-center p-3 border-l-4 border-blue-500 bg-blue-50 rounded">
              <Bell className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-blue-800">Pod web-app-xyz scheduled</p>
                <p className="text-xs text-blue-600">1 hour ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCostEfficiency = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard trend={5} title="Monthly Cost" value="$4,240" subtitle="All namespaces" icon={DollarSign} color="green" />
        <MetricCard trend={5} title="Resource Waste" value="18%" subtitle="Overprovisioned resources" icon={AlertTriangle} color="orange" />
        <MetricCard trend={5} title="Efficiency Score" value="82%" subtitle="Above target of 80%" icon={CheckCircle} color="green" />
        <MetricCard trend={5} title="Potential Savings" value="$760" subtitle="Monthly optimization" icon={DollarSign} color="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost by Namespace</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="namespace" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cost" fill="#3B82F6" name="Monthly Cost ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Waste Analysis</h3>
          <div className="space-y-4">
            {costData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{item.namespace}</h4>
                  <p className="text-sm text-gray-500">Monthly cost: ${item.cost}</p>
                </div>
                <div className="text-right">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    item.waste > 30 ? 'bg-red-100 text-red-800' :
                    item.waste > 20 ? 'bg-orange-100 text-orange-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {item.waste}% waste
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch(activeView) {
      case 'cluster': return renderClusterOverview();
      case 'namespaces': return renderNamespaces();
      case 'workloads': return renderWorkloads();
      case 'alerts': return renderAlerts();
      case 'cost': return renderCostEfficiency();
      default: return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{sidebarItems.find(item => item.id === activeView)?.label}</h3>
          <p className="text-gray-500">Dashboard view coming soon...</p>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Cloud className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">K8s Monitor</h1>
              <p className="text-xs text-gray-500">Kubernetes Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">MAIN</div>
          {sidebarItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">METRICS</div>
          {sidebarItems.slice(2, 9).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}

          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-6">PLATFORM</div>
          {sidebarItems.slice(9).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === item.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500">Kubernetes Platform Overview</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                {['1h', '6h', '24h', '7d', '30d'].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-400 hover:text-gray-600">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
              </button>

              {/* Add Cluster Button */}
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Add Cluster</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-6 overflow-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default K8sDashboard;