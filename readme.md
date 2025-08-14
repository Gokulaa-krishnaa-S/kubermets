# Database Schema Overview

We designed the database schema to follow a **normalized structure**, ensuring **efficient storage**, **scalability**, and **ease of querying**.

## 1. Entity Tables
We created separate **entity tables** — `Cluster`, `Node`, and `Pod` — to represent the Kubernetes infrastructure hierarchy (Have not updated yet currently using *metrics table alone).

- **Cluster**: Holds core information about each Kubernetes cluster.  
- **Node**: Stores details of nodes within a cluster.  
- **Pod**: Stores details of pods within a node.  

These tables represent the static infrastructure layout and are updated only when the Kubernetes topology changes.

## 2. Metric Tables
We created dedicated **metric tables** — `ClusterMetric`, `NodeMetric`, and `PodMetric` — to store **time-series performance and cost data**.

This separation ensures:
- Metrics are stored independently from entity definitions.  
- Historical data can be efficiently stored and queried.  
- Entity metadata is not duplicated in every metric entry.  

> **Note:** We see active data mainly in the `*_metrics` tables because they are updated regularly from monitoring pipelines, while the entity tables are relatively static.

## 3. Supporting Tables
We also included **supporting tables** to make the system extensible:

- **KubernetesInstance**: Stores connection and deployment details of monitored clusters.  
