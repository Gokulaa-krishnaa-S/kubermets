# Kubernetes Monitoring Module - Detailed Data Model

## 1. Database Schema Overview

### 1.1 Entity Relationship Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    clusters     │    │      nodes      │    │      pods       │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │◄───┤ cluster_id (FK) │◄───┤ node_id (FK)    │
│ name            │    │ id (PK)         │    │ id (PK)         │
│ status          │    │ name            │    │ name            │
│ created_at      │    │ status          │    │ namespace       │
│ updated_at      │    │ cpu_capacity    │    │ controller_name │
└─────────────────┘    │ memory_capacity │    │ controller_kind │
                       │ created_at      │    │ status          │
                       │ updated_at      │    │ created_at      │
                       └─────────────────┘    │ updated_at      │
                                              └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │  pod_metrics    │
                                              ├─────────────────┤
                                              │ id (PK)         │
                                              │ pod_id (FK)     │
                                              │ timestamp       │
                                              │ window          │
                                              │ total_cost      │
                                              │ cpu_cost        │
                                              │ memory_cost     │
                                              │ storage_cost    │
                                              │ pv_cost         │
                                              │ cpu_allocation  │
                                              │ memory_allocation│
                                              │ cpu_usage       │
                                              │ memory_usage    │
                                              │ cpu_efficiency  │
                                              │ memory_efficiency│
                                              │ raw_data        │
                                              │ argument_hash   │
                                              │ query_params    │
                                              └─────────────────┘

┌─────────────────┐    ┌─────────────────┐
│ kubernetes_     │    │   providers     │
│ instances       │    ├─────────────────┤
├─────────────────┤    │ id (PK)         │
│ id (PK)         │    │ name            │
│ name            │    │ logo_url        │
│ description     │    │ created_at      │
│ api_url         │    │ updated_at      │
│ client_name     │    └─────────────────┘
│ username        │
│ password        │
│ status          │
│ unique_hash     │
│ created_at      │
│ updated_at      │
└─────────────────┘

┌─────────────────┐    ┌─────────────────┐
│ cluster_metrics │    │  node_metrics   │
├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │
│ cluster_id (FK) │    │ node_id (FK)    │
│ timestamp       │    │ timestamp       │
│ window          │    │ window          │
│ total_cost      │    │ total_cost      │
│ cpu_cost        │    │ cpu_cost        │
│ memory_cost     │    │ memory_cost     │
│ storage_cost    │    │ storage_cost    │
│ network_cost    │    │ cpu_usage_percent│
│ cpu_usage_percent│   │ memory_usage_percent│
│ memory_usage_percent│ │ cpu_efficiency │
│ raw_data        │    │ memory_efficiency│
│ argument_hash   │    │ is_healthy      │
│ query_params    │    │ raw_data        │
└─────────────────┘    │ argument_hash   │
                       │ query_params    │
                       └─────────────────┘
```

## 2. Detailed Table Schemas

### 2.1 Core Entity Tables

#### Clusters Table

```sql
CREATE TABLE clusters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_clusters_status ON clusters(status);
CREATE INDEX idx_clusters_created ON clusters(created_at);
```

**Data Dictionary:**

- `id`: Unique identifier for each cluster
- `name`: Human-readable cluster name (must be unique)
- `status`: Current cluster status (active, inactive, unknown)
- `created_at`: Timestamp when cluster was first created
- `updated_at`: Timestamp when cluster was last modified

**Sample Data:**

```sql
INSERT INTO clusters (name, status) VALUES
('production-cluster', 'active'),
('staging-cluster', 'active'),
('development-cluster', 'inactive');
```

#### Nodes Table

```sql
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'unknown',
    cpu_capacity FLOAT,
    memory_capacity FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_nodes_cluster_id ON nodes(cluster_id);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_name ON nodes(name);
```

**Data Dictionary:**

- `id`: Unique identifier for each node
- `name`: Node hostname or identifier
- `cluster_id`: Foreign key to parent cluster
- `status`: Current node status (active, inactive, unknown)
- `cpu_capacity`: Total CPU cores available on node
- `memory_capacity`: Total memory available on node (in bytes)
- `created_at`: Timestamp when node was first created
- `updated_at`: Timestamp when node was last modified

**Sample Data:**

```sql
INSERT INTO nodes (name, cluster_id, status, cpu_capacity, memory_capacity) VALUES
('worker-node-1', 1, 'active', 8.0, 34359738368),
('worker-node-2', 1, 'active', 8.0, 34359738368),
('master-node', 1, 'active', 4.0, 17179869184);
```

#### Pods Table

```sql
CREATE TABLE pods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    namespace VARCHAR(100) NOT NULL,
    node_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
    controller_name VARCHAR(100),
    controller_kind VARCHAR(50),
    status VARCHAR(20) DEFAULT 'unknown',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_pods_namespace_name ON pods(namespace, name);
CREATE INDEX idx_pods_node_id ON pods(node_id);
CREATE INDEX idx_pods_status ON pods(status);
CREATE INDEX idx_pods_controller ON pods(controller_name, controller_kind);
```

**Data Dictionary:**

- `id`: Unique identifier for each pod
- `name`: Pod name within namespace
- `namespace`: Kubernetes namespace
- `node_id`: Foreign key to hosting node (nullable)
- `controller_name`: Name of controlling resource
- `controller_kind`: Type of controller (Deployment, StatefulSet, etc.)
- `status`: Current pod status (running, pending, failed, unknown)
- `created_at`: Timestamp when pod was first created
- `updated_at`: Timestamp when pod was last modified

**Sample Data:**

```sql
INSERT INTO pods (name, namespace, node_id, controller_name, controller_kind, status) VALUES
('web-app-abc123', 'production', 1, 'web-app', 'Deployment', 'running'),
('api-service-def456', 'production', 2, 'api-service', 'Deployment', 'running'),
('redis-cache-ghi789', 'production', 1, 'redis-cache', 'StatefulSet', 'running');
```

### 2.2 Metrics Tables

#### Cluster Metrics Table

```sql
CREATE TABLE cluster_metrics (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    window VARCHAR(10) NOT NULL,

    -- Cost metrics
    total_cost FLOAT DEFAULT 0.0,
    cpu_cost FLOAT DEFAULT 0.0,
    memory_cost FLOAT DEFAULT 0.0,
    storage_cost FLOAT DEFAULT 0.0,
    network_cost FLOAT DEFAULT 0.0,

    -- Resource utilization
    cpu_usage_percent FLOAT DEFAULT 0.0,
    memory_usage_percent FLOAT DEFAULT 0.0,

    -- Metadata
    raw_data JSONB,
    argument_hash VARCHAR(255),
    query_params JSONB
);

-- Indexes for performance
CREATE INDEX idx_cluster_metrics_time_window ON cluster_metrics(cluster_id, timestamp, window);
CREATE INDEX idx_cluster_metrics_timestamp ON cluster_metrics(timestamp);
CREATE INDEX idx_cluster_metrics_window ON cluster_metrics(window);
CREATE INDEX idx_cluster_metrics_hash ON cluster_metrics(argument_hash);
```

**Data Dictionary:**

- `id`: Unique identifier for each metric record
- `cluster_id`: Foreign key to parent cluster
- `timestamp`: When this metric was collected
- `window`: Time window for aggregation (1h, 6h, 24h, 7d, 30d)
- `total_cost`: Total cost for the cluster in the time window
- `cpu_cost`: CPU-related costs
- `memory_cost`: Memory-related costs
- `storage_cost`: Storage-related costs
- `network_cost`: Network-related costs
- `cpu_usage_percent`: Average CPU utilization percentage
- `memory_usage_percent`: Average memory utilization percentage
- `raw_data`: Full API response data for debugging
- `argument_hash`: Hash of query parameters for cache validation
- `query_params`: Original query parameters used

**Sample Data:**

```sql
INSERT INTO cluster_metrics (
    cluster_id, timestamp, window, total_cost, cpu_cost, memory_cost,
    storage_cost, network_cost, cpu_usage_percent, memory_usage_percent
) VALUES
(1, '2024-01-15 10:00:00', '24h', 45.67, 23.45, 12.34, 8.56, 1.32, 78.5, 65.2),
(1, '2024-01-15 10:00:00', '7d', 312.89, 156.78, 89.45, 58.23, 8.43, 72.1, 68.9);
```

#### Node Metrics Table

```sql
CREATE TABLE node_metrics (
    id SERIAL PRIMARY KEY,
    node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    window VARCHAR(10) NOT NULL,

    -- Cost metrics
    total_cost FLOAT DEFAULT 0.0,
    cpu_cost FLOAT DEFAULT 0.0,
    memory_cost FLOAT DEFAULT 0.0,
    storage_cost FLOAT DEFAULT 0.0,

    -- Resource utilization
    cpu_usage_percent FLOAT DEFAULT 0.0,
    memory_usage_percent FLOAT DEFAULT 0.0,
    cpu_efficiency FLOAT DEFAULT 0.0,
    memory_efficiency FLOAT DEFAULT 0.0,

    -- Health status
    is_healthy BOOLEAN DEFAULT TRUE,

    -- Metadata
    raw_data JSONB,
    argument_hash VARCHAR(255),
    query_params JSONB
);

-- Indexes for performance
CREATE INDEX idx_node_metrics_time_window ON node_metrics(node_id, timestamp, window);
CREATE INDEX idx_node_metrics_timestamp ON node_metrics(timestamp);
CREATE INDEX idx_node_metrics_health ON node_metrics(is_healthy);
CREATE INDEX idx_node_metrics_hash ON node_metrics(argument_hash);
```

**Data Dictionary:**

- `id`: Unique identifier for each metric record
- `node_id`: Foreign key to parent node
- `timestamp`: When this metric was collected
- `window`: Time window for aggregation
- `total_cost`: Total cost for the node in the time window
- `cpu_cost`: CPU-related costs
- `memory_cost`: Memory-related costs
- `storage_cost`: Storage-related costs
- `cpu_usage_percent`: CPU utilization percentage
- `memory_usage_percent`: Memory utilization percentage
- `cpu_efficiency`: CPU efficiency ratio (usage/request)
- `memory_efficiency`: Memory efficiency ratio (usage/request)
- `is_healthy`: Boolean indicating if node is healthy
- `raw_data`: Full API response data
- `argument_hash`: Hash of query parameters
- `query_params`: Original query parameters

#### Pod Metrics Table

```sql
CREATE TABLE pod_metrics (
    id SERIAL PRIMARY KEY,
    pod_id INTEGER REFERENCES pods(id) ON DELETE CASCADE,
    timestamp TIMESTAMP NOT NULL,
    window VARCHAR(10) NOT NULL,

    -- Cost metrics
    total_cost FLOAT DEFAULT 0.0,
    cpu_cost FLOAT DEFAULT 0.0,
    memory_cost FLOAT DEFAULT 0.0,
    storage_cost FLOAT DEFAULT 0.0,
    pv_cost FLOAT DEFAULT 0.0,

    -- Resource allocation and usage
    cpu_allocation FLOAT DEFAULT 0.0,
    memory_allocation FLOAT DEFAULT 0.0,
    cpu_usage FLOAT DEFAULT 0.0,
    memory_usage FLOAT DEFAULT 0.0,

    -- Efficiency metrics
    cpu_efficiency FLOAT DEFAULT 0.0,
    memory_efficiency FLOAT DEFAULT 0.0,

    -- Metadata
    raw_data JSONB,
    argument_hash VARCHAR(255),
    query_params JSONB
);

-- Indexes for performance
CREATE INDEX idx_pod_metrics_time_window ON pod_metrics(pod_id, timestamp, window);
CREATE INDEX idx_pod_metrics_timestamp ON pod_metrics(timestamp);
CREATE INDEX idx_pod_metrics_efficiency ON pod_metrics(cpu_efficiency, memory_efficiency);
CREATE INDEX idx_pod_metrics_hash ON pod_metrics(argument_hash);
```

**Data Dictionary:**

- `id`: Unique identifier for each metric record
- `pod_id`: Foreign key to parent pod
- `timestamp`: When this metric was collected
- `window`: Time window for aggregation
- `total_cost`: Total cost for the pod in the time window
- `cpu_cost`: CPU-related costs
- `memory_cost`: Memory-related costs
- `storage_cost`: Storage-related costs
- `pv_cost`: Persistent volume costs
- `cpu_allocation`: CPU cores allocated to pod
- `memory_allocation`: Memory allocated to pod (bytes)
- `cpu_usage`: Actual CPU usage by pod
- `memory_usage`: Actual memory usage by pod (bytes)
- `cpu_efficiency`: CPU efficiency ratio
- `memory_efficiency`: Memory efficiency ratio
- `raw_data`: Full API response data
- `argument_hash`: Hash of query parameters
- `query_params`: Original query parameters

### 2.3 Configuration Tables

#### Kubernetes Instances Table

```sql
CREATE TABLE kubernetes_instances (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    api_url VARCHAR(255) NOT NULL,
    client_name VARCHAR(100),
    username VARCHAR(100),
    password VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    unique_hash VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_instances_status ON kubernetes_instances(status);
CREATE INDEX idx_instances_hash ON kubernetes_instances(unique_hash);
CREATE INDEX idx_instances_client ON kubernetes_instances(client_name);
```

**Data Dictionary:**

- `id`: Unique identifier for each instance
- `name`: Human-readable instance name
- `description`: Detailed description of the instance
- `api_url`: Base URL for Kubecost API
- `client_name`: Client or organization name
- `username`: Authentication username
- `password`: Authentication password (encrypted)
- `status`: Instance status (active, inactive)
- `unique_hash`: Unique hash identifier for API calls
- `created_at`: Timestamp when instance was created
- `updated_at`: Timestamp when instance was last modified

**Sample Data:**

```sql
INSERT INTO kubernetes_instances (
    name, description, api_url, client_name, username, password, unique_hash
) VALUES
('Production Cluster', 'Main production environment', 'https://kubecost.prod.company.com', 'Company Inc', 'admin', 'encrypted_password', 'abc123def456'),
('Staging Cluster', 'Staging environment for testing', 'https://kubecost.staging.company.com', 'Company Inc', 'staging_user', 'encrypted_password', 'ghi789jkl012');
```

#### Providers Table

```sql
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_providers_name ON providers(name);
```

**Data Dictionary:**

- `id`: Unique identifier for each provider
- `name`: Provider name (AWS, GCP, Azure, etc.)
- `logo_url`: Path to provider logo image
- `created_at`: Timestamp when provider was created
- `updated_at`: Timestamp when provider was last modified

**Sample Data:**

```sql
INSERT INTO providers (name, logo_url) VALUES
('AWS', '/uploads/providers/aws-logo.png'),
('Google Cloud', '/uploads/providers/gcp-logo.png'),
('Microsoft Azure', '/uploads/providers/azure-logo.png'),
('On-Premises', '/uploads/providers/onprem-logo.png');
```

## 3. Data Relationships and Constraints

### 3.1 Foreign Key Relationships

```sql
-- Cluster to Nodes (One-to-Many)
ALTER TABLE nodes ADD CONSTRAINT fk_nodes_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE;

-- Node to Pods (One-to-Many)
ALTER TABLE pods ADD CONSTRAINT fk_pods_node
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL;

-- Cluster to Cluster Metrics (One-to-Many)
ALTER TABLE cluster_metrics ADD CONSTRAINT fk_cluster_metrics_cluster
    FOREIGN KEY (cluster_id) REFERENCES clusters(id) ON DELETE CASCADE;

-- Node to Node Metrics (One-to-Many)
ALTER TABLE node_metrics ADD CONSTRAINT fk_node_metrics_node
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE;

-- Pod to Pod Metrics (One-to-Many)
ALTER TABLE pod_metrics ADD CONSTRAINT fk_pod_metrics_pod
    FOREIGN KEY (pod_id) REFERENCES pods(id) ON DELETE CASCADE;
```

### 3.2 Data Integrity Constraints

```sql
-- Ensure positive costs
ALTER TABLE cluster_metrics ADD CONSTRAINT chk_cluster_metrics_costs
    CHECK (total_cost >= 0 AND cpu_cost >= 0 AND memory_cost >= 0 AND storage_cost >= 0 AND network_cost >= 0);

-- Ensure percentage values are valid
ALTER TABLE cluster_metrics ADD CONSTRAINT chk_cluster_metrics_percentages
    CHECK (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100 AND memory_usage_percent >= 0 AND memory_usage_percent <= 100);

-- Ensure valid time windows
ALTER TABLE cluster_metrics ADD CONSTRAINT chk_cluster_metrics_window
    CHECK (window IN ('1h', '6h', '24h', '7d', '30d'));

-- Ensure unique hash constraints
ALTER TABLE cluster_metrics ADD CONSTRAINT uk_cluster_metrics_hash
    UNIQUE (cluster_id, window, argument_hash);
```

## 4. Data Flow Patterns

### 4.1 Data Ingestion Flow

```
1. Background Scheduler triggers data refresh
2. For each Kubernetes instance:
   a. Fetch cluster data from Kubecost API
   b. Fetch node data from Kubecost API
   c. Fetch pod data from Kubecost API
3. Process and validate data
4. Store in appropriate tables
5. Update cache with new data
6. Log success/failure
```

### 4.2 Data Retrieval Flow

```
1. Frontend requests data via API
2. Backend checks cache validity
3. If cache valid: return cached data
4. If cache invalid: fetch from database
5. If database stale: fetch from Kubecost API
6. Process and aggregate data
7. Store updated data in database
8. Return processed data to frontend
```

### 4.3 Data Aggregation Patterns

```sql
-- Example: Get cluster summary for dashboard
SELECT
    c.name as cluster_name,
    c.status as cluster_status,
    COUNT(n.id) as node_count,
    COUNT(p.id) as pod_count,
    AVG(cm.total_cost) as avg_cost,
    AVG(cm.cpu_usage_percent) as avg_cpu_usage,
    AVG(cm.memory_usage_percent) as avg_memory_usage
FROM clusters c
LEFT JOIN nodes n ON c.id = n.cluster_id
LEFT JOIN pods p ON n.id = p.node_id
LEFT JOIN cluster_metrics cm ON c.id = cm.cluster_id
WHERE cm.window = '24h'
GROUP BY c.id, c.name, c.status;

-- Example: Get node efficiency metrics
SELECT
    n.name as node_name,
    c.name as cluster_name,
    nm.cpu_efficiency,
    nm.memory_efficiency,
    nm.is_healthy,
    nm.total_cost
FROM nodes n
JOIN clusters c ON n.cluster_id = c.id
JOIN node_metrics nm ON n.id = nm.node_id
WHERE nm.window = '24h'
ORDER BY nm.cpu_efficiency DESC;
```

## 5. Performance Optimization

### 5.1 Indexing Strategy

```sql
-- Composite indexes for time-based queries
CREATE INDEX idx_cluster_metrics_cluster_time ON cluster_metrics(cluster_id, timestamp);
CREATE INDEX idx_node_metrics_node_time ON node_metrics(node_id, timestamp);
CREATE INDEX idx_pod_metrics_pod_time ON pod_metrics(pod_id, timestamp);

-- Partial indexes for active records
CREATE INDEX idx_clusters_active ON clusters(id) WHERE status = 'active';
CREATE INDEX idx_nodes_active ON nodes(id) WHERE status = 'active';
CREATE INDEX idx_pods_running ON pods(id) WHERE status = 'running';

-- Function-based indexes for common queries
CREATE INDEX idx_cluster_metrics_cost_window ON cluster_metrics(window, total_cost);
CREATE INDEX idx_node_metrics_health_time ON node_metrics(is_healthy, timestamp);
```

### 5.2 Partitioning Strategy

```sql
-- Partition metrics tables by time for better performance
-- Example for cluster_metrics (PostgreSQL 10+)
CREATE TABLE cluster_metrics_y2024m01 PARTITION OF cluster_metrics
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE cluster_metrics_y2024m02 PARTITION OF cluster_metrics
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### 5.3 Data Retention Policies (not enabled)

```sql
-- Cleanup old metrics data
DELETE FROM cluster_metrics
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM node_metrics
WHERE timestamp < NOW() - INTERVAL '90 days';

DELETE FROM pod_metrics
WHERE timestamp < NOW() - INTERVAL '90 days';
```

This comprehensive data model provides the foundation for a robust, scalable, and performant Kubernetes monitoring system with proper data relationships, constraints, and optimization strategies.
