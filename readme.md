# Kubernetes Monitoring Module - Design Document

## 1. Executive Summary

The Kubernetes Monitoring Module is a comprehensive monitoring and cost management solution built with a modern React frontend and Flask backend. The system integrates with Kubecost APIs to provide real-time monitoring, cost analysis, and resource optimization insights for Kubernetes clusters.

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React + TS)  │◄──►│   (Flask)       │◄──►│   (Kubecost)    │
│   Port: 4000    │    │   Port: 8000    │    │   API           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   Background    │
│   Database      │    │   Scheduler     │
│   Port: 5432    │    │   (APScheduler) │
└─────────────────┘    └─────────────────┘
```

### 2.2 Technology Stack

**Frontend:**

- React 18.3.1 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Shadcn/ui component library
- Recharts for data visualization
- React Query for state management
- React Router for navigation

**Backend:**

- Flask (Python) web framework
- SQLAlchemy ORM with PostgreSQL
- APScheduler for background tasks
- Flasgger for API documentation
- CORS enabled for cross-origin requests

**Infrastructure:**

- Docker containers with docker-compose
- PostgreSQL 15 database
- Background task scheduling
- Caching layer with TTL

## 3. Data Flow Architecture

### 3.1 Data Flow Diagram

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Kubecost   │───►│   Backend   │───►│ PostgreSQL  │───►│  Frontend   │
│    API      │    │   Service   │    │   Cache     │    │   Display   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Real-time  │    │  Background │    │  Structured │    │  Interactive│
│   Metrics   │    │   Refresh   │    │   Storage   │    │    UI       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 3.2 Data Processing Pipeline

1. **Data Collection**: Kubecost API calls with authentication
2. **Data Processing**: Backend service layer with business logic
3. **Data Storage**: PostgreSQL with structured tables and JSON fields
4. **Data Retrieval**: Cached responses with TTL-based invalidation
5. **Data Presentation**: React components with real-time updates

## 4. Data Model Design

### 4.1 Core Entities

#### Cluster Entity

```sql
clusters:
- id (Primary Key)
- name (Unique, Required)
- status (active/inactive/unknown)
- created_at, updated_at (Timestamps)
```

#### Node Entity

```sql
nodes:
- id (Primary Key)
- name (Required)
- cluster_id (Foreign Key to clusters)
- status (active/inactive/unknown)
- cpu_capacity, memory_capacity (Resource limits)
- created_at, updated_at (Timestamps)
```

#### Pod Entity

```sql
pods:
- id (Primary Key)
- name, namespace (Required)
- node_id (Foreign Key to nodes)
- controller_name, controller_kind
- status (running/pending/failed)
- created_at, updated_at (Timestamps)
```

### 4.2 Metrics Entities

#### Cluster Metrics

```sql
cluster_metrics:
- id (Primary Key)
- cluster_id (Foreign Key)
- timestamp, window (1h, 6h, 24h, 7d, 30d)
- total_cost, cpu_cost, memory_cost, storage_cost, network_cost
- cpu_usage_percent, memory_usage_percent
- raw_data (JSON), argument_hash, query_params
```

#### Node Metrics

```sql
node_metrics:
- id (Primary Key)
- node_id (Foreign Key)
- timestamp, window
- total_cost, cpu_cost, memory_cost, storage_cost
- cpu_usage_percent, memory_usage_percent
- cpu_efficiency, memory_efficiency
- is_healthy (Boolean)
- raw_data (JSON), argument_hash, query_params
```

#### Pod Metrics

```sql
pod_metrics:
- id (Primary Key)
- pod_id (Foreign Key)
- timestamp, window
- total_cost, cpu_cost, memory_cost, storage_cost, pv_cost
- cpu_allocation, memory_allocation
- cpu_usage, memory_usage
- cpu_efficiency, memory_efficiency
- raw_data (JSON), argument_hash, query_params
```

### 4.3 Configuration Entities

#### Kubernetes Instance

```sql
kubernetes_instances:
- id (Primary Key)
- name (Unique, Required)
- description, api_url (Required)
- client_name, username, password
- status (active/inactive)
- unique_hash (Unique identifier)
- created_at, updated_at (Timestamps)
```

#### Provider

```sql
providers:
- id (Primary Key)
- name (Unique, Required)
- logo_url (Image path)
- created_at, updated_at (Timestamps)
```

## 5. API Design

### 5.1 Core Endpoints

#### Cluster Management

- `GET /v1/clusters/status` - Get cluster status and metrics
- `GET /v1/clusters/nodes` - Get node information and metrics
- `GET /v1/all` - Unified API for all metrics with aggregation

#### Pod Management

- `GET /v1/get_pod_details` - Get specific pod details
- `GET /v1/dashboard/summary` - Dashboard summary with aggregated metrics

#### Instance Management

- `GET /v1/instance` - List all Kubernetes instances
- `POST /v1/instance` - Create new Kubernetes instance
- `PUT /v1/instance/<id>` - Update existing instance

#### Provider Management

- `GET /v1/providers` - List all providers
- `POST /v1/provider/add` - Create new provider with logo upload

#### Cache Management

- `GET /v1/cache/status` - Get cache status and statistics
- `POST /v1/cache/clear` - Clear all cached data
- `POST /v1/data/refresh` - Force refresh of all data

### 5.2 Query Parameters

- `window`: Time window (1h, 6h, 24h, 7d, 30d)
- `aggregate`: Aggregation type (cluster, node, pod, controller, namespace)
- `chartType`: Chart type (costovertime, etc.)
- `force_refresh`: Force API call instead of using cache
- `offset`, `limit`: Pagination parameters

## 6. Frontend Architecture

### 6.1 Component Structure

```
src/
├── components/
│   ├── dashboard/          # Dashboard components
│   │   ├── MetricCard.tsx
│   │   ├── QuickStats.tsx
│   │   └── StatusBadge.tsx
│   ├── chart/             # Chart components
│   │   ├── DonutChart.tsx
│   │   ├── GroupedBarChart.tsx
│   │   └── LineChart.tsx
│   ├── layout/            # Layout components
│   │   ├── Header.tsx
│   │   ├── Layout.tsx
│   │   └── Sidebar.tsx
│   ├── modals/            # Modal components
│   │   ├── ClusterDetailModal.tsx
│   │   └── podDetailMetrics.tsx
│   ├── reusable/          # Reusable components
│   │   ├── domainDropdown.tsx
│   │   ├── filterbar.tsx
│   │   └── domainTypeAhead.tsx
│   └── ui/                # UI components (Shadcn)
├── pages/                 # Page components
│   ├── Dashboard.tsx
│   ├── K8newDashbaord.tsx
│   ├── ClusterMetrics.tsx
│   ├── NodeMetrics.tsx
│   ├── PodMetrics.tsx
│   ├── AlertsAndCost.tsx
│   ├── BillingAndCost.tsx
│   └── Settings.tsx
├── services/              # API services
│   ├── ClusterService.tsx
│   ├── dashboardService.tsx
│   ├── KubernetesService.tsx
│   └── podService.tsx
├── hooks/                 # Custom hooks
├── context/               # React context
│   └── ClusterContext.tsx
└── lib/                   # Utility functions
```

### 6.2 State Management

- **React Context**: ClusterContext for global instance management
- **React Query**: Server state management and caching
- **Local State**: Component-level state with useState
- **Props**: Component communication through props

### 6.3 Routing Structure

```
/                    → Overview page
/overview           → Overview page
/new                → K8s Dashboard
/alerts-events      → Alerts and Events
/billing-cost       → Billing and Cost
/settings           → Settings
/instance           → Kubernetes Instance List
/metric/*           → Nested metric routes
```

## 7. Backend Architecture

### 7.1 Service Layer

- **KubecostDataService**: Core service for Kubecost API integration
- **DatabaseManager**: SQLAlchemy database connection management
- **Background Scheduler**: APScheduler for periodic data refresh

### 7.2 Controller Layer

- **ClusterController**: Business logic for cluster operations
- **Data Processing**: Aggregation and calculation logic
- **Error Handling**: Comprehensive error handling and logging

### 7.3 Data Caching Strategy

- **TTL-based Caching**: Configurable cache duration (default: 5 minutes)
- **Hash-based Validation**: Argument hash for cache key generation
- **Background Refresh**: Scheduled data refresh with configurable intervals
- **Force Refresh**: Manual cache invalidation capability

## 8. Monitoring and Observability

### 8.1 Health Checks

- **Database Connection**: PostgreSQL connectivity verification
- **Kubecost API**: External API health monitoring
- **Background Tasks**: Scheduler status and job execution
- **Cache Status**: Cache hit/miss statistics

### 8.2 Logging and Metrics

- **Structured Logging**: JSON-formatted logs with levels
- **Performance Metrics**: API response times and throughput
- **Error Tracking**: Comprehensive error logging with context
- **Audit Trail**: Data access and modification logging

### 8.3 Background Tasks

- **Data Refresh**: Periodic Kubecost data synchronization
- **Cache Cleanup**: Automated cache maintenance
- **Health Monitoring**: Continuous system health checks
- **Data Retention**: Configurable data retention policies

## 9. Security Considerations

### 9.1 Authentication

- **Basic Auth**: Username/password for Kubecost API access
- **Instance Isolation**: Hash-based instance identification
- **API Key Management**: Secure credential storage

### 9.2 Data Protection

- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Parameterized queries with SQLAlchemy
- **CORS Configuration**: Controlled cross-origin access
- **File Upload Security**: File type validation and secure storage

## 10. Performance Optimization

### 10.1 Caching Strategy

- **Multi-level Caching**: Database + Application level caching
- **Smart Invalidation**: TTL + Hash-based cache invalidation
- **Background Refresh**: Proactive data updates

### 10.2 Database Optimization

- **Indexed Queries**: Composite indexes for time-based queries
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Optimized SQL queries with proper joins

### 10.3 Frontend Optimization

- **Code Splitting**: Route-based code splitting
- **Lazy Loading**: Component lazy loading for better performance
- **Virtual Scrolling**: Large dataset handling
- **Debounced Updates**: Optimized API calls

## 11. Deployment and Infrastructure

### 11.1 Containerization

- **Multi-stage Builds**: Optimized Docker images
- **Service Dependencies**: Proper service orchestration
- **Volume Management**: Persistent data storage
- **Environment Configuration**: Environment variable management

### 11.2 Scalability

- **Horizontal Scaling**: Stateless backend services
- **Database Scaling**: PostgreSQL read replicas
- **Load Balancing**: Frontend load distribution
- **Auto-scaling**: Kubernetes HPA integration

## 12. Future Enhancements

### 12.1 Planned Features

- **Real-time Notifications**: WebSocket-based alerts
- **Advanced Analytics**: Machine learning insights
- **Multi-tenant Support**: Instance isolation and management
- **API Rate Limiting**: Request throttling and quotas

### 12.2 Technical Improvements

- **GraphQL API**: Flexible data querying
- **Microservices Architecture**: Service decomposition
- **Event-driven Architecture**: Asynchronous event processing
- **Advanced Caching**: Redis integration for better performance

## 13. Conclusion

The Kubernetes Monitoring Module provides a robust, scalable, and user-friendly solution for monitoring Kubernetes clusters. The architecture follows modern best practices with clear separation of concerns, comprehensive error handling, and efficient data management. The system is designed to handle multiple instances, provide real-time insights, and scale with growing infrastructure needs.

The modular design allows for easy maintenance and future enhancements while maintaining high performance and reliability standards.
