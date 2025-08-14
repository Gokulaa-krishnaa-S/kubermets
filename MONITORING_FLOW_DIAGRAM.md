# Kubernetes Monitoring Module - Flow Diagrams

## 1. System Overview Flow

```mermaid
graph TB
    A[User Interface] --> B[Frontend React App]
    B --> C[Backend Flask API]
    C --> D[PostgreSQL Database]
    C --> E[Kubecost External API]

    F[Background Scheduler] --> C


    subgraph "Frontend Layer"
        A
        B
    end

    subgraph "Backend Layer"
        C
        F
    end

    subgraph "Data Layer"
        D
        E
    end
```

## 2. Data Collection Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Database
    participant KubecostAPI

    User->>Frontend: Request Metrics
    Frontend->>Backend: API Call

    alt Cache Hit
        Backend->>Database: Query Cached Data
        Database-->>Backend: Return Cached Data
        Backend-->>Frontend: Return Data
        Frontend-->>User: Display Metrics
    else Cache Miss
        Backend->>KubecostAPI: Request Real-time Data
        KubecostAPI-->>Backend: Return Metrics
        Backend->>Database: Store New Data
        Backend-->>Frontend: Return Fresh Data
        Frontend-->>User: Display Metrics
    end
```

## 3. Background Data Refresh Flow (not enabled)

```mermaid
graph TD
    A[APScheduler] --> B[Background Job Trigger]
    B --> C[Data Refresh Service]

    C --> D[Get All Instances]
    D --> E[For Each Instance]

    E --> F[Fetch Cluster Data]
    E --> G[Fetch Node Data]
    E --> H[Fetch Pod Data]

    F --> I[Update Database]
    G --> I
    H --> I

    I --> J[Log Success/Error]
    J --> K[Wait for Next Interval]
    K --> A

    style A fill:#e1f5fe
    style I fill:#c8e6c9
    style J fill:#fff3e0
```

## 4. Dashboard Data Aggregation Flow

```mermaid
graph TD
    A[Dashboard Request] --> B[Get All Instances]
    B --> C[Parallel Processing]

    C --> D[Process Instance 1]
    C --> E[Process Instance 2]
    C --> F[Process Instance N]

    D --> G[Fetch Cluster Metrics]
    D --> H[Fetch Node Metrics]
    D --> I[Fetch Pod Metrics]

    E --> J[Fetch Cluster Metrics]
    E --> K[Fetch Node Metrics]
    E --> L[Fetch Pod Metrics]

    F --> M[Fetch Cluster Metrics]
    F --> N[Fetch Node Metrics]
    F --> O[Fetch Pod Metrics]

    G --> P[Aggregate Results]
    H --> P
    I --> P
    J --> P
    K --> P
    L --> P
    M --> P
    N --> P
    O --> P

    P --> Q[Calculate Totals]
    P --> R[Calculate Averages]
    P --> S[Calculate Percentages]

    Q --> T[Return Dashboard Data]
    R --> T
    S --> T

    style A fill:#e3f2fd
    style P fill:#f3e5f5
    style T fill:#e8f5e8
```

## 5. Cache Management Flow

```mermaid
graph TD
    A[API Request] --> B{Check Cache}

    B -->|Valid| C[Return Cached Data]
    B -->|Expired| D[Fetch from Kubecost]
    B -->|Not Found| D

    D --> E[Process Data]
    E --> F[Store in Database]
    F --> G[Return Fresh Data]

    K[Manual Refresh] --> L[Force Data Fetch]
    L --> D

    style A fill:#e8f5e8
    style C fill:#c8e6c9
    style G fill:#c8e6c9
    style H fill:#fff3e0
```

## 6. Error Handling Flow

```mermaid
graph TD
    A[API Request] --> B{Try Operation}

    B -->|Success| C[Return Success Response]

    B -->|Database Error| D[Log Database Error]
    B -->|API Error| E[Log API Error]
    B -->|Validation Error| F[Log Validation Error]
    B -->|Network Error| G[Log Network Error]

    D --> H[Return Error Response]
    E --> H
    F --> H
    G --> H

    H --> I[Client Error Handling]
    I --> J[User Notification]

    style A fill:#e8f5e8
    style C fill:#c8e6c9
    style H fill:#ffcdd2
```

## 7. Real-time Monitoring Flow

```mermaid
graph TD
    A[User Opens Dashboard] --> B[Initialize Real-time Updates]

    B --> C[Set Update Interval]
    C --> D[Fetch Initial Data]

    D --> E[Display Current Metrics]

    C --> F[Periodic Updates]
    F --> G[Check for Changes]

    G -->|No Changes| H[Continue Monitoring]
    G -->|Changes Detected| I[Update UI]

    H --> F
    I --> E

    J[User Interaction] --> K[Manual Refresh]
    K --> D

    style A fill:#e3f2fd
    style E fill:#c8e6c9
    style I fill:#fff3e0
```

## 8. Data Processing Pipeline

```mermaid
graph LR
    A[Raw Kubecost Data] --> B[Data Validation]
    B --> C[Data Transformation]
    C --> D[Business Logic Processing]
    D --> E[Data Aggregation]
    E --> F[Database Storage]
    F --> G[Cache Update]
    G --> H[Response Generation]

    style A fill:#e3f2fd
    style D fill:#f3e5f5
    style F fill:#e8f5e8
    style H fill:#c8e6c9
```

## 9. Component Interaction Flow

```mermaid
graph TD
    A[App Component] --> B[ClusterProvider Context]
    B --> C[Router Configuration]

    C --> D[Overview Page]
    C --> E[K8s Dashboard]
    C --> F[Metrics Pages]
    C --> G[Settings Page]

    D --> H[QuickStats Component]
    E --> I[Chart Components]
    F --> J[Metric Components]
    G --> K[Configuration Components]

    H --> L[ClusterService]
    I --> L
    J --> L
    K --> L

    L --> M[Backend API]

    style A fill:#e3f2fd
    style B fill:#f3e5f5
    style L fill:#e8f5e8
    style M fill:#c8e6c9
```

## Key Flow Characteristics

### 1. **Asynchronous Processing** (not enabled)

- Background data refresh with configurable intervals
- Parallel processing of multiple instances
- Non-blocking API responses

### 2. **Caching Strategy**

- Multi-level caching (Database + Application)
- Hash-based cache key generation

### 3. **Error Resilience**

- Comprehensive error handling at each layer
- Graceful degradation for failed components
- Retry mechanisms for transient failures

### 4. **Real-time Updates**

- Periodic data refresh
- Change detection and UI updates
- User-triggered manual refresh

### 5. **Scalability Features**

- Stateless backend services
- Database connection pooling
