// services/ClusterService.ts
import axios, { AxiosInstance, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  throw new Error(
    "VITE_API_BASE_URL is not defined in the environment variables"
  );
}

interface QueryParams {
  [key: string]: string | number | boolean | undefined;
}

interface MetricsResponse<T> {
  data: T[];
  total_count: number;
  limit: number;
  offset: number;
}

interface ClusterMetric {
  id: number;
  cluster_name: string;
  timestamp: string;
  window_start: string;
  window_end: string;
  window_duration: string;
  total_cost: number;
  cpu_cost: number;
  ram_cost: number;
  cpu_core_usage_average: number;
  cpu_core_request_average: number;
  ram_byte_usage_average: number;
  ram_byte_request_average: number;
  total_efficiency: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  cluster_status: string;
  node_count: number;
  pod_count: number;
  efficiency_category: string;
  created_at: string;
}

interface NodeMetric {
  id: number;
  node_name: string;
  cluster_name: string;
  timestamp: string;
  window_start: string;
  window_end: string;
  window_duration: string;
  total_cost: number;
  cpu_cost: number;
  ram_cost: number;
  cpu_core_usage_average: number;
  cpu_core_request_average: number;
  ram_byte_usage_average: number;
  ram_byte_request_average: number;
  total_efficiency: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  node_status: string;
  node_instance_type: string;
  node_zone: string;
  is_active: boolean;
  created_at: string;
}

interface PodMetric {
  id: number;
  key: string;
  namespace: string;
  name: string;
  start_time: string;
  end_time: string;
  window: string;
  total_cost: number;
  cpu_cost: number;
  ram_cost: number;
  cpu_core_usage_average: number;
  cpu_core_request_average: number;
  ram_byte_usage_average: number;
  ram_byte_request_average: number;
  total_efficiency: number;
  cpu_efficiency: number;
  ram_efficiency: number;
  is_idle: boolean;
  domain: string;
  created_at: string;
}

interface PodDetail extends PodMetric {
  gpu_cost: number;
  pv_cost: number;
  network_cost: number;
  load_balancer_cost: number;
  external_cost: number;
  shared_cost: number;
  gpu_usage_average: number;
  gpu_request_average: number;
  ram_usage_gb: number;
  ram_request_gb: number;
  updated_at: string;
  raw_allocation_data: any;
}

interface DashboardSummary {
  total_clusters: number;
  total_nodes: number;
  total_pods: number;
  total_cost: number;
  average_efficiency: number;
  latest_metrics: Array<{
    cluster_name: string;
    total_cost: number;
    efficiency: number;
    timestamp: string;
  }>;
}

class ClusterService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Fetch allocation summary for clusters using external query params
   */
  async getClusterAllocationSummary(queryParams: QueryParams): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get("/all", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching cluster summary:", error);
      throw error;
    }
  }

  /**
   * Get cluster metrics from database
   */
  // Updated ClusterService method
  async getClusterMetrics(queryParams?: {
    cluster_name?: string;
    window_duration?: string;
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<MetricsResponse<ClusterMetric>> {
    console.log("=== ClusterService.getClusterMetrics called ===");
    console.log("Fetching cluster metrics with filters:", queryParams);

    try {
      // Clean up undefined values to avoid sending them as "undefined" strings
      const cleanParams = queryParams
        ? Object.fromEntries(
            Object.entries(queryParams).filter(
              ([_, v]) => v !== undefined && v !== null
            )
          )
        : {};

      console.log("Clean params being sent:", cleanParams);
      console.log("API endpoint:", "/clusters");

      const response: AxiosResponse<MetricsResponse<ClusterMetric>> =
        await this.api.get("/clusters", {
          params: cleanParams,
        });

      console.log("Cluster metrics response status:", response.status);
      console.log("Cluster metrics response data:", response.data);

      return response.data;
    } catch (error) {
      console.error("=== Error in ClusterService.getClusterMetrics ===");
      console.error("Error fetching cluster metrics:", error);

      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        console.error("Response headers:", error.response.headers);
      } else if (error.request) {
        console.error("Request made but no response received:", error.request);
      } else {
        console.error("Error setting up request:", error.message);
      }

      throw error;
    }
  }
  /**
   * Get node metrics from database
   */
  async getNodeMetrics(queryParams?: {
    node_name?: string;
    cluster_name?: string;
    window_duration?: string;
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<MetricsResponse<NodeMetric>> {
    try {
      const response: AxiosResponse<MetricsResponse<NodeMetric>> =
        await this.api.get("/nodes", {
          params: queryParams,
        });
      return response.data;
    } catch (error) {
      console.error("Error fetching node metrics:", error);
      throw error;
    }
  }

  /**
   * Get pod metrics from database
   */
  async getPodMetrics(queryParams?: {
    namespace?: string;
    name?: string;
    window?: string;
    limit?: number;
    offset?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<MetricsResponse<PodMetric>> {
    try {
      const response: AxiosResponse<MetricsResponse<PodMetric>> =
        await this.api.get("/pods", {
          params: queryParams,
        });
      return response.data;
    } catch (error) {
      console.error("Error fetching pod metrics:", error);
      throw error;
    }
  }

  /**
   * Get specific pod details by ID or key
   */
  async getPodDetails(queryParams: {
    id?: number;
    key?: string;
  }): Promise<{ data: PodDetail }> {
    try {
      const response: AxiosResponse<{ data: PodDetail }> = await this.api.get(
        "/get_pod_details",
        {
          params: queryParams,
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching pod details:", error);
      throw error;
    }
  }

  /**
   * Get dashboard summary with aggregated metrics
   */
  async getDashboardSummary(): Promise<{ data: DashboardSummary }> {
    try {
      const response: AxiosResponse<{ data: DashboardSummary }> =
        await this.api.get("/dashboard/summary");
      return response.data;
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      throw error;
    }
  }

  /**
   * Get list of all Kubernetes instances
   */
  async getInstanceList() {
    try {
      const response: AxiosResponse = await this.api.get("/instance");
      return response.data;
    } catch (error) {
      console.error("Error fetching instance list:", error);
      throw error;
    }
  }

  /**
   * Create a new Kubernetes instance
   */
  async createInstance(data: Record<string, any>) {
    try {
      const response: AxiosResponse = await this.api.post("/instance", data);
      return response.data;
    } catch (error) {
      console.error("Error creating instance:", error);
      throw error;
    }
  }

  /**
   * Update an existing Kubernetes instance
   */
  async updateInstance(instanceId: number, data: Record<string, any>) {
    try {
      const response: AxiosResponse = await this.api.put(
        `/instance/${instanceId}`,
        data
      );
      return response.data;
    } catch (error) {
      console.error("Error updating instance:", error);
      throw error;
    }
  }

  /**
   * @deprecated Use getDashboardSummary() instead
   */
  async getAllMetrics() {
    try {
      const response: AxiosResponse = await this.api.get(`dashboard/summary`);
      console.log(response, "--------------------------");
      return response.data;
    } catch (error) {
      console.error("Error updating instance:", error);
      throw error;
    }
  }

  async createProvider(data: FormData) {
    try {
      const response: AxiosResponse = await this.api.post(
        `provider/add`,
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error adding provider:", error);
      throw error;
    }
  }

  async getProviders() {
    try {
      const response: AxiosResponse = await this.api.get(`providers`);
      return response.data;
    } catch (error) {
      console.error("Error updating instance:", error);
      throw error;
    }
  }

  /**
   * Bulk insert metrics (POST endpoint)
   */
  async insertMetrics(data: {
    cluster_metrics?: any[];
    node_metrics?: any[];
    pod_metrics?: any[];
  }) {
    try {
      const response: AxiosResponse = await this.api.post(
        "/fetchMetrics",
        data
      );
      return response.data;
    } catch (error) {
      console.error("Error inserting metrics:", error);
      throw error;
    }
  }
}

export default new ClusterService();
