// API service for cluster creation operations
// Adapted from env_react_base for monitoring frontend integration

// Get configuration from environment or default values
const API_BASE_URL = import.meta.env.VITE_BACKEND_API_BASE_URL || '';
const CLUSTER_METHOD = import.meta.env.VITE_CLUSTER_CREATION_METHOD || 1;
const INFRA_BASE_URL = import.meta.env.VITE_INFRA_BASE_URL;

// Helper to read a cookie value in the browser
const getCookieValue = (name: string): string | null => {
  try {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|; )' + encodeURIComponent(name) + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
};

export interface ClusterData {
  id?: string|number;
  user_id?: string;
  cluster_type: string;
  config: any;
  created_at?: string;
  updated_at?: string;
}

export interface NamespaceData {
  id?: number;
  user_id: number;
  cluster_id?: number;
  cluster_type?: string;
  namespace_data: {
    clusterFqn: string;
    name: string;
    collaborators?: Array<{ email: string; role: string }>;
    repository?: boolean;
    permissions?: Array<{ repository: string; role: string }>;
    labels?: string[];
    annotations?: string[];
  };
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  message: string;
  data: T;
}

class ClusterCreationApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Inject Authorization header from Keycloak token cookie if present
    const bearer = getCookieValue('token');
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      ...options,
    };

    try {
      const response = await fetch(url, defaultOptions);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Create or update cluster
  async createOrUpdateCluster(clusterData: ClusterData): Promise<ApiResponse<ClusterData>> {
    const method = clusterData.id ? 'PUT' : 'POST';
    // Attach creation method and infra base for backend routing
    const payload: any = { ...clusterData, __creation_method: CLUSTER_METHOD };
    if (CLUSTER_METHOD === 2 && INFRA_BASE_URL) {
      payload.__infra_base = INFRA_BASE_URL;
    }
    return this.makeRequest<ClusterData>('/clusters', {
      method,
      body: JSON.stringify(payload),
    });
  }

  // Get all clusters
  async getAllClusters(): Promise<ApiResponse<ClusterData[]>> {
    return this.makeRequest<ClusterData[]>('/clusters');
  }

  // Get cluster by ID
  async getClusterById(id: number): Promise<ApiResponse<ClusterData>> {
    return this.makeRequest<ClusterData>(`/clusters/${id}`);
  }

  // Get clusters by type
  async getClustersByType(clusterType: string): Promise<ApiResponse<ClusterData[]>> {
    const response = await this.makeRequest<ClusterData[]>('/clusters');
    const filteredClusters = response.data.filter(
      cluster => cluster.cluster_type === clusterType
    );
    return {
      message: `Clusters of type ${clusterType} retrieved successfully`,
      data: filteredClusters,
    };
  }

  // Validate cluster name and region combination
  async validateClusterName(clusterName: string, region: string, clusterType: string, excludeId?: number): Promise<ApiResponse<{ exists: boolean; message?: string }>> {
    return this.makeRequest<{ exists: boolean; message?: string }>('/clusters/validate', {
      method: 'POST',
      body: JSON.stringify({
        clusterName,
        region,
        clusterType,
        excludeId
      }),
    });
  }

  // Get GCP clusters for existing cluster import
  async getGcpClusters(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/gcp_clusters`, {
        headers: {
          'Content-Type': 'application/json',
          ...(getCookieValue('token') ? { Authorization: `Bearer ${getCookieValue('token')}` } : {}),
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching GCP clusters:', error);
      throw error;
    }
  }

  // Create existing cluster import
  async createExistingCluster(clusterData: any): Promise<ApiResponse<ClusterData> & { workloads?: any }> {
    // Tag requests from existing cluster flow
    // Don't add isImported here - let the backend handle it
    const payload = { ...clusterData };
    console.log('API Service - Final payload being sent to backend:', JSON.stringify(payload, null, 2));
    return this.makeRequest<ClusterData>('/clusters/existing', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Update existing cluster import
  async updateExistingCluster(clusterId: number, clusterData: any): Promise<ApiResponse<ClusterData>> {
    // Tag requests from existing cluster flow
    const payload = { ...clusterData, isImported: 1 };
    return this.makeRequest<ClusterData>(`/clusters/existing/${clusterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // Get cluster workloads
  async getClusterWorkloads(clusterId: number): Promise<ApiResponse<any>> {
    return this.makeRequest<any>(`/clusters/${clusterId}/workloads`);
  }
}

export const clusterCreationApi = new ClusterCreationApiService();

class NamespaceApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const bearer = getCookieValue('token');
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      ...options,
    };
    try {
      const response = await fetch(url, defaultOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Create Namespace
  async createNamespace(NamespaceData: Omit<NamespaceData, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<NamespaceData>> {
    return this.makeRequest<NamespaceData>('/namespaces', {
      method: 'POST',
      body: JSON.stringify(NamespaceData),
    });
  }

  // Update Namespace
  async updateNamespace(id: number, NamespaceData: NamespaceData): Promise<ApiResponse<NamespaceData>> {
    return this.makeRequest<NamespaceData>(`/namespaces/${id}`, {
      method: 'PUT',
      body: JSON.stringify(NamespaceData),
    });
  }

  // Create or update Namespace (smart method)
  async createOrUpdateNamespace(NamespaceData: NamespaceData): Promise<ApiResponse<NamespaceData>> {
    // Use the combined endpoint that handles both create and update
    return this.makeRequest<NamespaceData>('/namespaces', {
      method: NamespaceData.id ? 'PUT' : 'POST',
      body: JSON.stringify(NamespaceData),
    });
  }

  // Get all Namespaces
  async getAllNamespaces(): Promise<ApiResponse<NamespaceData[]>> {
    return this.makeRequest<NamespaceData[]>('/namespaces');
  }

  // Get Namespaces (alias for getAllNamespaces)
  async getNamespaces(): Promise<ApiResponse<NamespaceData[]>> {
    return this.getAllNamespaces();
  }

  // Get Namespace by ID
  async getNamespaceById(id: number): Promise<ApiResponse<NamespaceData>> {
    return this.makeRequest<NamespaceData>(`/namespaces/${id}`);
  }

  // Delete Namespace
  async deleteNamespace(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/namespaces/${id}`, {
      method: 'DELETE',
    });
  }
}

export const namespaceApi = new NamespaceApiService();

// Tag API Service
export interface TagData {
  id?: number;
  user_id: number;
  status: string;
  tag_data: {
    name: string;
    tag_type: string;
    optimized_for: string;
    tag_colour: string;
  };
  created_at?: string;
  updated_at?: string;
}

class TagApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const bearer = getCookieValue('token');
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      ...options,
    };
    try {
      const response = await fetch(url, defaultOptions);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Create or update tag
  async createOrUpdateTag(tagData: TagData): Promise<ApiResponse<TagData>> {
    const method = tagData.id ? 'PUT' : 'POST';
    
    return this.makeRequest<TagData>('/tags', {
      method,
      body: JSON.stringify(tagData),
    });
  }

  // Get all tags
  async getAllTags(): Promise<ApiResponse<TagData[]>> {
    return this.makeRequest<TagData[]>('/tags');
  }

  // Get tag by ID
  async getTagById(id: number): Promise<ApiResponse<TagData>> {
    return this.makeRequest<TagData>(`/tags/${id}`);
  }

  // Delete tag
  async deleteTag(id: number): Promise<ApiResponse<{ success: boolean }>> {
    return this.makeRequest<{ success: boolean }>(`/tags/${id}`, {
      method: 'DELETE',
    });
  }

  // Get tags by user ID
  async getTagsByUserId(userId: number): Promise<ApiResponse<TagData[]>> {
    return this.makeRequest<TagData[]>(`/tags/user/${userId}`);
  }
}

export const tagApi = new TagApiService();

// Function to fetch cluster details from GCP API (infra service preferred)
export const fetchClusterDetails = async (
  clusterName: string,
  location: string,
  options?: { isImported?: number; serviceAccountJson?: any }
) => {
  try {
    const bearer = getCookieValue('token');
    // Normalize location: if a zone like "asia-south1-a" is provided, send region "asia-south1"
    const normalizedLocation = location && location.includes('-') && location.split('-').length === 3
      ? location.split('-').slice(0, 2).join('-')
      : location;
    // Prefer infra base when available
    const detailsBase = INFRA_BASE_URL || API_BASE_URL;
    const response = await fetch(`${detailsBase}/clusters/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({
        clusterName: clusterName,
        location: normalizedLocation,
        ...(options && typeof options.isImported !== 'undefined' ? { isImported: options.isImported } : {}),
        ...(options && options.isImported === 1 && options.serviceAccountJson ? { service_account_json: options.serviceAccountJson } : {})
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching cluster details:', error);
    throw error;
  }
};

// Fetch cluster details by clusterId via backend, which proxies to infra service using stored config
export const fetchClusterDetailsById = async (clusterId: number) => {
  try {
    const bearer = getCookieValue('token');
    const response = await fetch(`${API_BASE_URL}/clusters/details`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({ clusterId })
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching cluster details by id:', error);
    throw error;
  }
};


