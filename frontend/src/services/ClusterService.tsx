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
   * @param queryParams - key-value pairs for the query string
   */
  async getClusterAllocationSummary(
    queryParams: Record<string, any>
  ): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get("/all", {
        params: queryParams,
      });
      console.log(response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetching cluster summary:", error);
      throw error;
    }
  }
}

export default new ClusterService();
