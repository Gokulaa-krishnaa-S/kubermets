import axios, { AxiosInstance, AxiosResponse } from "axios";

const k8sBaseURL = import.meta.env.VITE_K8S_API_BASE_URL;

if (!k8sBaseURL) {
  console.warn(
    "VITE_K8S_API_BASE_URL is not defined. Using default Kubernetes API server."
  );
}

export interface KubernetesNode {
  name: string;
  cluster: string;
  status: "Ready" | "NotReady" | "Unknown";
  cpu: {
    capacity: string;
    allocatable: string;
    usage: string;
    percentage: number;
  };
  memory: {
    capacity: string;
    allocatable: string;
    usage: string;
    percentage: number;
  };
  pods: {
    capacity: number;
    allocatable: number;
    running: number;
  };
  roles: string[];
  labels: Record<string, string>;
  conditions: Array<{
    type: string;
    status: string;
    lastHeartbeatTime: string;
    reason?: string;
    message?: string;
  }>;
  lastUpdated: string;
}

export interface KubernetesPod {
  name: string;
  namespace: string;
  node: string;
  cluster: string;
  status: "Running" | "Pending" | "Failed" | "Succeeded" | "Unknown";
  containers: Array<{
    name: string;
    image: string;
    ready: boolean;
    restartCount: number;
    state: string;
  }>;
  resources: {
    cpu: {
      requests: string;
      limits: string;
      usage: string;
    };
    memory: {
      requests: string;
      limits: string;
      usage: string;
    };
  };
  labels: Record<string, string>;
  age: string;
  lastUpdated: string;
}

export interface KubernetesNamespace {
  name: string;
  status: string;
  labels: Record<string, string>;
  age: string;
}

export interface ClusterSummary {
  totalNodes: number;
  totalPods: number;
  totalNamespaces: number;
  readyNodes: number;
  runningPods: number;
  nodes: KubernetesNode[];
  pods: KubernetesPod[];
  namespaces: KubernetesNamespace[];
}

class KubernetesService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: k8sBaseURL || "/api/v1",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    });

    // Add request interceptor for authentication if needed
    this.api.interceptors.request.use((config) => {
      // Add authentication headers if available
      const token = localStorage.getItem("k8s-token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(
          "Kubernetes API Error:",
          error.response?.data || error.message
        );
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get comprehensive cluster summary
   */
  async getClusterSummary(): Promise<ClusterSummary> {
    try {
      const [nodes, pods, namespaces] = await Promise.all([
        this.getNodes(),
        this.getPods(),
        this.getNamespaces(),
      ]);

      const readyNodes = nodes.filter((node) => node.status === "Ready").length;
      const runningPods = pods.filter((pod) => pod.status === "Running").length;

      return {
        totalNodes: nodes.length,
        totalPods: pods.length,
        totalNamespaces: namespaces.length,
        readyNodes,
        runningPods,
        nodes,
        pods,
        namespaces,
      };
    } catch (error) {
      console.error("Error fetching cluster summary:", error);
      throw error;
    }
  }

  /**
   * Get all nodes
   */
  async getNodes(): Promise<KubernetesNode[]> {
    try {
      const response: AxiosResponse = await this.api.get("/nodes");
      return response.data.items.map((node: any) => this.mapNode(node));
    } catch (error) {
      console.error("Error fetching nodes:", error);
      return [];
    }
  }

  /**
   * Get all pods
   */
  async getPods(): Promise<KubernetesPod[]> {
    try {
      const response: AxiosResponse = await this.api.get("/pods");
      return response.data.items.map((pod: any) => this.mapPod(pod));
    } catch (error) {
      console.error("Error fetching pods:", error);
      return [];
    }
  }

  /**
   * Get pods by namespace
   */
  async getPodsByNamespace(namespace: string): Promise<KubernetesPod[]> {
    try {
      const response: AxiosResponse = await this.api.get(
        `/namespaces/${namespace}/pods`
      );
      return response.data.items.map((pod: any) => this.mapPod(pod));
    } catch (error) {
      console.error(`Error fetching pods for namespace ${namespace}:`, error);
      return [];
    }
  }

  /**
   * Get all namespaces
   */
  async getNamespaces(): Promise<KubernetesNamespace[]> {
    try {
      const response: AxiosResponse = await this.api.get("/namespaces");
      return response.data.items.map((namespace: any) =>
        this.mapNamespace(namespace)
      );
    } catch (error) {
      console.error("Error fetching namespaces:", error);
      return [];
    }
  }

  /**
   * Get node details by name
   */
  async getNode(name: string): Promise<KubernetesNode | null> {
    try {
      const response: AxiosResponse = await this.api.get(`/nodes/${name}`);
      return this.mapNode(response.data);
    } catch (error) {
      console.error(`Error fetching node ${name}:`, error);
      return null;
    }
  }

  /**
   * Get pod details by name and namespace
   */
  async getPod(name: string, namespace: string): Promise<KubernetesPod | null> {
    try {
      const response: AxiosResponse = await this.api.get(
        `/namespaces/${namespace}/pods/${name}`
      );
      return this.mapPod(response.data);
    } catch (error) {
      console.error(
        `Error fetching pod ${name} in namespace ${namespace}:`,
        error
      );
      return null;
    }
  }

  /**
   * Get resource usage metrics (requires metrics-server)
   */
  async getResourceMetrics(): Promise<any> {
    try {
      const [nodeMetrics, podMetrics] = await Promise.all([
        this.api.get("/apis/metrics.k8s.io/v1beta1/nodes"),
        this.api.get("/apis/metrics.k8s.io/v1beta1/pods"),
      ]);

      return {
        nodes: nodeMetrics.data.items,
        pods: podMetrics.data.items,
      };
    } catch (error) {
      console.error("Error fetching resource metrics:", error);
      return { nodes: [], pods: [] };
    }
  }

  /**
   * Map Kubernetes node data to our interface
   */
  private mapNode(node: any): KubernetesNode {
    const readyCondition = node.status.conditions?.find(
      (c: any) => c.type === "Ready"
    );
    const status = readyCondition?.status === "True" ? "Ready" : "NotReady";

    const roles = Object.keys(node.metadata.labels || {})
      .filter((label) => label.includes("node-role.kubernetes.io/"))
      .map((label) => label.replace("node-role.kubernetes.io/", ""));

    return {
      name: node.metadata.name,
      cluster: node.metadata.labels?.["kubernetes.io/cluster"] || "default",
      status,
      cpu: {
        capacity: node.status.capacity?.cpu || "0",
        allocatable: node.status.allocatable?.cpu || "0",
        usage: "0", // Will be updated with metrics
        percentage: 0,
      },
      memory: {
        capacity: node.status.capacity?.memory || "0",
        allocatable: node.status.allocatable?.memory || "0",
        usage: "0", // Will be updated with metrics
        percentage: 0,
      },
      pods: {
        capacity: parseInt(node.status.capacity?.pods || "0"),
        allocatable: parseInt(node.status.allocatable?.pods || "0"),
        running: 0, // Will be calculated
      },
      roles,
      labels: node.metadata.labels || {},
      conditions: node.status.conditions || [],
      lastUpdated: node.metadata.creationTimestamp,
    };
  }

  /**
   * Map Kubernetes pod data to our interface
   */
  private mapPod(pod: any): KubernetesPod {
    const containers =
      pod.spec.containers?.map((container: any) => ({
        name: container.name,
        image: container.image,
        ready:
          pod.status.containerStatuses?.find(
            (cs: any) => cs.name === container.name
          )?.ready || false,
        restartCount:
          pod.status.containerStatuses?.find(
            (cs: any) => cs.name === container.name
          )?.restartCount || 0,
        state: this.getContainerState(
          pod.status.containerStatuses?.find(
            (cs: any) => cs.name === container.name
          )
        ),
      })) || [];

    return {
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      node: pod.spec.nodeName || "Unknown",
      cluster: pod.metadata.labels?.["kubernetes.io/cluster"] || "default",
      status: pod.status.phase,
      containers,
      resources: {
        cpu: {
          requests: this.calculateTotalResource(
            pod.spec.containers,
            "cpu",
            "requests"
          ),
          limits: this.calculateTotalResource(
            pod.spec.containers,
            "cpu",
            "limits"
          ),
          usage: "0", // Will be updated with metrics
        },
        memory: {
          requests: this.calculateTotalResource(
            pod.spec.containers,
            "memory",
            "requests"
          ),
          limits: this.calculateTotalResource(
            pod.spec.containers,
            "memory",
            "limits"
          ),
          usage: "0", // Will be updated with metrics
        },
      },
      labels: pod.metadata.labels || {},
      age: this.calculateAge(pod.metadata.creationTimestamp),
      lastUpdated: pod.metadata.creationTimestamp,
    };
  }

  /**
   * Map Kubernetes namespace data to our interface
   */
  private mapNamespace(namespace: any): KubernetesNamespace {
    return {
      name: namespace.metadata.name,
      status: namespace.status.phase,
      labels: namespace.metadata.labels || {},
      age: this.calculateAge(namespace.metadata.creationTimestamp),
    };
  }

  /**
   * Calculate total resource requests/limits for a pod
   */
  private calculateTotalResource(
    containers: any[],
    resource: string,
    type: "requests" | "limits"
  ): string {
    const total = containers.reduce((sum: number, container: any) => {
      const value = container.resources?.[type]?.[resource] || "0";
      return sum + this.parseResourceValue(value, resource);
    }, 0);

    return this.formatResourceValue(total, resource);
  }

  /**
   * Parse resource value to number
   */
  private parseResourceValue(value: string, resource: string): number {
    if (resource === "cpu") {
      return parseFloat(value) || 0;
    } else {
      // Memory in bytes
      const units = { Ki: 1024, Mi: 1024 * 1024, Gi: 1024 * 1024 * 1024 };
      const match = value.match(/^(\d+(?:\.\d+)?)(Ki|Mi|Gi)?$/);
      if (match) {
        const num = parseFloat(match[1]);
        const unit = match[2];
        return num * (units[unit as keyof typeof units] || 1);
      }
      return 0;
    }
  }

  /**
   * Format resource value for display
   */
  private formatResourceValue(value: number, resource: string): string {
    if (resource === "cpu") {
      return `${value.toFixed(2)} cores`;
    } else {
      const units = ["B", "KB", "MB", "GB"];
      let unitIndex = 0;
      let formattedValue = value;

      while (formattedValue >= 1024 && unitIndex < units.length - 1) {
        formattedValue /= 1024;
        unitIndex++;
      }

      return `${formattedValue.toFixed(2)} ${units[unitIndex]}`;
    }
  }

  /**
   * Get container state
   */
  private getContainerState(containerStatus: any): string {
    if (!containerStatus) return "Unknown";

    if (containerStatus.state?.running) return "Running";
    if (containerStatus.state?.waiting) return "Waiting";
    if (containerStatus.state?.terminated) return "Terminated";

    return "Unknown";
  }

  /**
   * Calculate age from timestamp
   */
  private calculateAge(timestamp: string): string {
    const age = Date.now() - new Date(timestamp).getTime();
    const days = Math.floor(age / (1000 * 60 * 60 * 24));
    const hours = Math.floor((age % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${Math.floor(age / (1000 * 60))}m`;
    }
  }
}

export default new KubernetesService();
