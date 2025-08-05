import os

def get_cluster_status():
    baseDomain = os.getenv("domain")
    
    return {"status": "Cluster is running", "key_used": baseDomain}


def get_node_info():
    return {"nodes": ["node1", "node2", "node3"]}
