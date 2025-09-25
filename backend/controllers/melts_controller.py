from models.model import Melts
from datetime import datetime

def set_melts_data(session, cluster_id, user_id, payload):
    """
    Insert a new row into the Melts table.
    """
    if not cluster_id:
        raise ValueError("cluster_id is required")

    # Create new record
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
