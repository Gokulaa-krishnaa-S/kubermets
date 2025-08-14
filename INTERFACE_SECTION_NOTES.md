# Kubernetes Monitoring Module - Interface & Section Notes

## 1. Frontend Interface Components

### 1.1 Main Navigation & Layout

#### Header Component (`Header.tsx`)

- **Purpose**: Main navigation header with branding and user controls
- **Features**:
  - Logo and application title
  - User profile/settings dropdown
  - Notification center
  - Search functionality
  - Responsive mobile menu
- **Key Elements**:
  - Company branding (Sify logo)
  - User authentication status
  - Global search bar
  - Theme toggle (light/dark mode)

#### Sidebar Component (`Sidebar.tsx`)

- **Purpose**: Left navigation sidebar with main menu items
- **Navigation Structure**:
  - Dashboard/Overview
  - Cluster Management
  - Node Monitoring
  - Pod Analytics
  - Cost & Billing
  - Alerts & Events
  - Settings & Configuration
- **Features**:
  - Collapsible design
  - Active state highlighting
  - Icon-based navigation
  - Nested menu support

#### Layout Component (`Layout.tsx`)

- **Purpose**: Main layout wrapper combining header, sidebar, and content
- **Responsive Design**:
  - Mobile-first approach
  - Collapsible sidebar on small screens
  - Flexible content area
- **State Management**:
  - Sidebar open/close state
  - Mobile menu state
  - Content area sizing

### 1.2 Dashboard Components

#### QuickStats Component (`QuickStats.tsx`)

- **Purpose**: Display key performance indicators at a glance
- **Metrics Displayed**:
  - Running Blueprints count
  - Active Agents status
  - K8s Clusters health
  - GPU Utilization percentage
- **Features**:
  - Trend indicators (up/down/neutral)
  - Status color coding
  - Clickable cards for detailed views
  - Real-time updates

#### MetricCard Component (`MetricCard.tsx`)

- **Purpose**: Individual metric display card with consistent styling
- **Design Elements**:
  - Metric title and value
  - Trend indicator with direction
  - Status badge (healthy/warning/critical)
  - Icon representation
  - Hover effects and interactions
- **Variants**:
  - Success state (green)
  - Warning state (yellow)
  - Critical state (red)
  - Neutral state (gray)

#### StatusBadge Component (`StatusBadge.tsx`)

- **Purpose**: Visual status indicators for various system states
- **Status Types**:
  - Healthy (green)
  - Warning (yellow)
  - Critical (red)
  - Unknown (gray)
- **Usage**:
  - Cluster health status
  - Node availability
  - Pod running state
  - Service status

### 1.3 Chart Components

#### DonutChart Component (`DonutChart.tsx`)

- **Purpose**: Circular chart for proportional data visualization
- **Use Cases**:
  - Resource allocation breakdown
  - Cost distribution by namespace
  - Cluster health percentages
  - Node status distribution
- **Features**:
  - Interactive tooltips
  - Color-coded segments
  - Legend display
  - Responsive sizing

#### GroupedBarChart Component (`GroupedBarChart.tsx`)

- **Purpose**: Grouped bar charts for comparing multiple metrics
- **Use Cases**:
  - CPU vs Memory usage comparison
  - Cost trends over time
  - Resource allocation by namespace
  - Performance metrics comparison
- **Features**:
  - Multiple data series
  - X-axis and Y-axis labels
  - Grid lines for readability
  - Hover interactions

#### LineChart Component (`LineChart.tsx`)

- **Purpose**: Time-series data visualization
- **Use Cases**:
  - Resource usage over time
  - Cost trends
  - Performance metrics history
  - System health monitoring
- **Features**:
  - Multiple line support
  - Time-based X-axis
  - Smooth curve rendering
  - Zoom and pan capabilities

### 1.4 Modal Components

#### ClusterDetailModal Component (`ClusterDetailModal.tsx`)

- **Purpose**: Detailed view of cluster information and metrics
- **Content Sections**:
  - Basic cluster information
  - Resource utilization graphs
  - Cost breakdown
  - Node list and status
  - Performance metrics
- **Features**:
  - Expandable sections
  - Real-time data updates
  - Export functionality
  - Action buttons (restart, scale, etc.)

#### PodDetailMetrics Component (`podDetailMetrics.tsx`)

- **Purpose**: Detailed pod metrics and performance data
- **Metrics Displayed**:
  - CPU and memory usage
  - Network I/O statistics
  - Storage metrics
  - Cost breakdown
  - Performance trends
- **Features**:
  - Time-range selection
  - Metric filtering
  - Comparison views
  - Alert configuration

### 1.5 Reusable Components

#### DomainDropdown Component (`domainDropdown.tsx`)

- **Purpose**: Instance selection dropdown for multi-cluster environments
- **Features**:
  - Searchable dropdown
  - Instance grouping
  - Status indicators
  - Quick switching
- **Usage**:
  - Cluster selection
  - Environment switching
  - Instance management

#### FilterBar Component (`filterbar.tsx`)

- **Purpose**: Advanced filtering and search capabilities
- **Filter Options**:
  - Time range selection
  - Namespace filtering
  - Resource type selection
  - Cost threshold filtering
- **Features**:
  - Multiple filter criteria
  - Saved filter presets
  - Clear all filters
  - Filter count display

#### DomainTypeAhead Component (`domainTypeAhead.tsx`)

- **Purpose**: Autocomplete search for domains/instances
- **Features**:
  - Real-time search suggestions
  - Fuzzy matching
  - Recent searches
  - Quick access to frequently used instances

## 2. Backend Interface Components

### 2.1 API Endpoints

#### Cluster Management Endpoints

- **`GET /v1/clusters/status`**

  - **Purpose**: Retrieve cluster status and health metrics
  - **Parameters**:
    - `window`: Time window (1h, 6h, 24h, 7d, 30d)
    - `force_refresh`: Force API call instead of cache
  - **Response**: Cluster metrics with health status
  - **Use Case**: Dashboard overview and health monitoring

- **`GET /v1/clusters/nodes`**
  - **Purpose**: Get node information and performance metrics
  - **Parameters**:
    - `window`: Time window for metrics
    - `force_refresh`: Cache bypass flag
  - **Response**: Node list with metrics and status
  - **Use Case**: Node monitoring and capacity planning

#### Unified Metrics Endpoint

- **`GET /v1/all`**
  - **Purpose**: Single endpoint for all metric types with aggregation
  - **Parameters**:
    - `window`: Time window
    - `aggregate`: Aggregation type (cluster, node, pod, controller, namespace)
    - `chartType`: Chart visualization type
    - `force_refresh`: Cache control
  - **Response**: Aggregated metrics based on parameters
  - **Use Case**: Flexible data retrieval for different views

#### Dashboard Summary Endpoint

- **`GET /v1/dashboard/summary`**
  - **Purpose**: Comprehensive dashboard data with backend aggregation
  - **Parameters**:
    - `window`: Time window for metrics
    - `force_refresh`: Force data refresh
    - `offset`, `limit`: Pagination support
  - **Response**: Aggregated metrics across all instances
  - **Use Case**: Main dashboard with overview statistics

### 2.2 Data Service Layer

#### KubecostDataService Class

- **Purpose**: Core service for Kubecost API integration
- **Key Methods**:
  - `_make_kubecost_request()`: Authenticated API calls
  - `get_cluster_data()`: Cluster metrics retrieval
  - `get_node_data()`: Node metrics collection
  - `get_pod_data()`: Pod-level metrics
- **Features**:
  - Multi-instance support
  - Authentication handling
  - Error handling and retry logic
  - Response caching

#### Database Manager

- **Purpose**: SQLAlchemy database connection and management
- **Features**:
  - Connection pooling
  - Session management
  - Table creation and maintenance
  - Transaction handling

### 2.3 Background Task Management

#### APScheduler Integration

- **Purpose**: Automated background data refresh
- **Scheduled Jobs**:
  - Periodic data refresh (configurable interval)
  - Daily cleanup operations
  - Health check monitoring
- **Configuration**:
  - Environment variable control
  - Configurable refresh intervals
  - Graceful shutdown handling

## 3. Data Models & Interfaces

### 3.1 Core Data Entities

#### Cluster Entity Interface

```typescript
interface Cluster {
  id: number;
  name: string;
  status: "active" | "inactive" | "unknown";
  created_at: Date;
  updated_at: Date;
  cluster_metrics: ClusterMetric[];
  nodes: Node[];
}
```

#### Node Entity Interface

```typescript
interface Node {
  id: number;
  name: string;
  cluster_id: number;
  status: "active" | "inactive" | "unknown";
  cpu_capacity: number;
  memory_capacity: number;
  created_at: Date;
  updated_at: Date;
  cluster: Cluster;
  node_metrics: NodeMetric[];
  pods: Pod[];
}
```

#### Pod Entity Interface

```typescript
interface Pod {
  id: number;
  name: string;
  namespace: string;
  node_id: number;
  controller_name: string;
  controller_kind: string;
  status: "running" | "pending" | "failed";
  created_at: Date;
  updated_at: Date;
  node: Node;
  pod_metrics: PodMetric[];
}
```

### 3.2 Metrics Data Interfaces

#### Cluster Metrics Interface

```typescript
interface ClusterMetric {
  id: number;
  cluster_id: number;
  timestamp: Date;
  window: string;
  total_cost: number;
  cpu_cost: number;
  memory_cost: number;
  storage_cost: number;
  network_cost: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  raw_data: any;
  argument_hash: string;
  query_params: any;
}
```

#### Node Metrics Interface

```typescript
interface NodeMetric {
  id: number;
  node_id: number;
  timestamp: Date;
  window: string;
  total_cost: number;
  cpu_cost: number;
  memory_cost: number;
  storage_cost: number;
  cpu_usage_percent: number;
  memory_usage_percent: number;
  cpu_efficiency: number;
  memory_efficiency: number;
  is_healthy: boolean;
  raw_data: any;
  argument_hash: string;
  query_params: any;
}
```

## 4. User Interface Sections

### 4.1 Overview Section (`Overview.tsx`)

- **Purpose**: Main landing page with system overview
- **Components**:
  - QuickStats dashboard
  - Recent activity feed
  - System health summary
  - Quick action buttons
- **Features**:
  - Real-time updates
  - Interactive metrics
  - Navigation shortcuts
  - Status overview

### 4.2 K8s Dashboard Section (`K8newDashbaord.tsx`)

- **Purpose**: Comprehensive Kubernetes monitoring dashboard
- **Views**:
  - Cluster overview
  - Namespace management
  - Node metrics
  - Workload monitoring
  - Pod analytics
  - Control plane status
  - Networking metrics
  - Storage monitoring
  - Alerts and events
  - Cost analysis
- **Features**:
  - Multi-view navigation
  - Real-time data updates
  - Interactive charts
  - Filtering and search
  - Export capabilities

### 4.3 Metrics Routes Section (`MetricRoutes.tsx`)

- **Purpose**: Nested routing for detailed metric views
- **Sub-routes**:
  - Cluster metrics
  - Node metrics
  - Pod metrics
  - Custom metric views
- **Features**:
  - Dynamic routing
  - Parameter passing
  - Shared components
  - Breadcrumb navigation

### 4.4 Alerts & Events Section (`AlertsAndCost.tsx`) (future Enhancements)

- **Purpose**: Monitoring alerts and system events
- **Features**:
  - Alert severity levels
  - Event timeline
  - Alert configuration
  - Notification settings
  - Cost impact analysis

### 4.5 Billing & Cost Section (`BillingAndCost.tsx`) (future Enhancements)

- **Purpose**: Cost analysis and billing management
- **Features**:
  - Cost breakdown by resource
  - Budget tracking
  - Cost optimization recommendations
  - Historical cost trends
  - Resource efficiency metrics

### 4.6 Settings Section (`Settings.tsx`)

- **Purpose**: System configuration and user preferences
- **Configuration Areas**:
  - Instance management
  - Provider configuration
  - User preferences
  - System settings
  - API configuration

## 5. Integration Points

### 5.1 External API Integration

- **Kubecost API**: Primary data source for metrics
- **Authentication**: Basic auth with username/password
- **Rate Limiting**: Configurable request throttling
- **Error Handling**: Comprehensive error management

### 5.2 Database Integration

- **PostgreSQL**: Primary data store
- **Connection Pooling**: Efficient connection management
- **Indexing**: Optimized query performance
- **Backup**: Automated backup strategies

### 5.3 File System Integration

- **Provider Logos**: Image storage and management
- **File Validation**: Security and type checking
- **Storage Management**: Efficient file organization
- **Access Control**: Secure file access

## 6. Performance Considerations

### 6.1 Frontend Performance

- **Code Splitting**: Route-based lazy loading
- **Component Optimization**: Memoization and optimization
- **Bundle Size**: Tree shaking and optimization
- **Caching**: Client-side caching strategies

### 6.2 Backend Performance

- **Database Optimization**: Query optimization and indexing
- **Caching Strategy**: Multi-level caching approach
- **Background Processing**: Asynchronous data updates
- **Connection Pooling**: Efficient resource management

### 6.3 Data Processing

- **Batch Processing**: Efficient bulk operations
- **Parallel Processing**: Concurrent data fetching
- **Memory Management**: Efficient data structures
- **Error Recovery**: Graceful failure handling

## 7. Security Features

### 7.1 Input Validation

- **Parameter Validation**: Comprehensive input checking
- **SQL Injection Prevention**: Parameterized queries
- **File Upload Security**: Type and size validation
- **XSS Prevention**: Output sanitization

### 7.2 Authentication & Authorization

- **Instance Isolation**: Hash-based separation
- **Credential Management**: Secure storage
- **Session Management**: Secure session handling

### 7.3 Data Protection

- **Data Encryption**: Sensitive data protection
- **Audit Logging**: Comprehensive activity tracking
- **Backup Security**: Secure backup procedures
- **Network Security**: CORS and firewall configuration
