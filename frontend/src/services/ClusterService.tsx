// services/ClusterService.ts
import axios, { AxiosInstance, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  throw new Error(
    "VITE_API_BASE_URL is not defined in the environment variables"
  );
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
  async getClusterAllocationSummary(
    queryParams: Record<string, any>
  ): Promise<any> {
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
  async getAllMetrics() {
    try {
      const response: AxiosResponse = await this.api.get(`dashboard/summary`);
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
}

export default new ClusterService();
