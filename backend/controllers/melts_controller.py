from models.model import Melts, ClusterMetrics
from datetime import datetime
from sqlalchemy.orm.exc import NoResultFound

def set_melts_data(session, cluster_id, user_id, payload):
    """
    Insert a new row into the Melts table.
    
    Args:
        session: SQLAlchemy session
        cluster_id: ID of the cluster
        user_id: ID of the user
        payload: JSON payload to store
        
    Returns:
        dict: Created melts data
        
    Raises:
        ValueError: If required fields are missing or invalid
        NoResultFound: If cluster_id doesn't exist
    """
    # Validate required fields
    if not cluster_id:
        raise ValueError("cluster_id is required")
    if not user_id:
        raise ValueError("user_id is required")
        
    # Verify cluster exists
    try:
        cluster = session.query(ClusterMetrics).filter(
            ClusterMetrics.id == cluster_id
        ).first()
        if not cluster:
            raise ValueError(f"Cluster with id {cluster_id} does not exist")
        
    except NoResultFound:
        raise ValueError(f"Cluster with id {cluster_id} does not exist")    

    # Create new records
    new_melt = Melts(
        cluster_id=cluster_id,
        user_id=user_id,
        payload=payload,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )

    session.add(new_melt)
    session.commit()
    session.refresh(new_melt)

    return {
        "id": new_melt.id,
        "cluster_id": new_melt.cluster_id,
        "user_id": new_melt.user_id,
        "payload": new_melt.payload,
        "created_at": new_melt.created_at,
        "updated_at": new_melt.updated_at,
    }
