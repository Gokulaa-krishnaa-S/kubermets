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

interface NodeMetrics {
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
  // async getClusterAllocationSummary(queryParams: QueryParams): Promise<any> {
  //   try {
  //     const response: AxiosResponse = await this.api.get("/all", {
  //       params: queryParams,
  //     });
  //     return response.data;
  //   } catch (error) {
  //     console.error("Error fetching cluster summary:", error);
  //     throw error;
  //   }
  // }

   /**
   * Fetch allocation summary for clusters using external query params
   */
  async getNodeAllocationSummary(queryParams: QueryParams): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get("/nodes", {
        params: queryParams,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching cluster summary:", error);
      throw error;
    }
  }


}

export default new ClusterService();
