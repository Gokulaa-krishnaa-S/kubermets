// services/podService.ts
import axios, { AxiosInstance, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  throw new Error(
    "VITE_API_BASE_URL is not defined in the environment variables"
  );
}

interface PodMetricsQueryParams {
  cluster_id: string;
  duration?: string;
  namespace?: string;
  search?: string;
}

interface PodDetailsQueryParams {
  cluster_id: string;
  namespace?: string;
  duration?: string;
  domain?: string;
}

class PodService {
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
   * Fetch Pod Metrics from database
   * @param queryParams - Parameters for fetching pod metrics
   */
  async getPodMetrics(
    queryParams: PodMetricsQueryParams
  ): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get("/pods", {
        params: queryParams,
      });
      console.log("Pod metrics response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching pod metrics:", error);
      throw error;
    }
  }

  /**
   * Fetch Pod Specific Details from database
   * @param podName - Name of the pod
   * @param queryParams - Parameters for the query
   */
  async getPodDetails(
    podName: string,
    queryParams: PodDetailsQueryParams
  ): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get(`/pods/${podName}/details`, {
        params: queryParams,
      });
      console.log("Pod details response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching pod details:", error);
      throw error;
    }
  }

  /**
   * Legacy method - Fetch Pod Details (keep for backward compatibility)
   * @param queryParams - key-value pairs for the query string
   */
  async getPodDetailsLegacy(
    queryParams: Record<string, any>
  ): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get("/get_pod_details", {
        params: queryParams,
      });
      console.log("Legacy pod details response:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching legacy pod details:", error);
      throw error;
    }
  }
}

export default new PodService();