// services/DashboardService.ts
import axios, { AxiosInstance, AxiosResponse } from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL;

if (!baseURL) {
  throw new Error(
    "REACT_APP_API_BASE_URL is not defined in the environment variables"
  );
}

class DashboardService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  async getMetrics(): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.get("/metrics");
      return response.data;
    } catch (error) {
      console.error("Error fetching metrics:", error);
      throw error;
    }
  }

  async postFilterData(payload: any): Promise<any> {
    try {
      const response: AxiosResponse = await this.api.post("/filter", payload);
      return response.data;
    } catch (error) {
      console.error("Error posting filter data:", error);
      throw error;
    }
  }

  // Additional methods can go here
}

export default new DashboardService();
