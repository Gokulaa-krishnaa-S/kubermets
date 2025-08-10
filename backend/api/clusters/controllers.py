import os
import requests
from flask import Flask, request, jsonify


def get_cluster_status():
    base_domain = os.getenv("domain")
    window = request.args.get("window", "7d")

    base_path = "/model/allocation/summary"
    query_string = (
        f"?window={window}"
        "&aggregate=cluster"
        "&accumulate=true"
        "&external=false"
        "&shareCost=0"
        "&shareTenancyCosts=true"
        "&idle=true"
        "&shareIdle=true"
        "&idleByNode=true"
        "&shareLabels="
        "&shareNamespaces="
        "&shareSplit=weighted"
        "&filter="
    )

    full_url = f"{base_domain}{base_path}{query_string}"
    print(full_url, "---------")

    try:
        res = requests.get(full_url)
        res.raise_for_status()
        data = res.json()
        return {"status": "success", "data": data}
    except requests.exceptions.RequestException as e:
        return {"status": "failed", "error": str(e), "source": full_url}, 500


def summaryApi():
    base_domain = os.getenv("domain")
    base_path = "/model/allocation/summary"
    default_params = {
        "accumulate": "true",
        "aggregate": "controller",
        "chartType": "costovertime",
        "costUnit": "cumulative",
        "external": "false",
        "filter": "",
        "idle": "true",
        "idleByNode": "false",
        "includeSharedCostBreakdown": "true",
        "shareCost": "0",
        "shareIdle": "false",
        "shareLabels": "",
        "shareNamespaces": "",
        "shareSplit": "weighted",
        "shareTenancyCosts": "true",
        "window": "7d",
        "offset": "0",
        "limit": "50",
    }

    query_params = {
        key: request.args.get(key, default) for key, default in default_params.items()
    }

    query_string = "?" + "&".join(
        f"{key}={value}" for key, value in query_params.items()
    )
    full_url = f"{base_domain}{base_path}{query_string}"
    print(full_url, "---------")

    try:
        headers = {"Authorization": f"Basic YWRtaW46QWRtaW5AMTIjJA=="}

        res = requests.get(full_url, headers=headers)
        # res = requests.get(full_url)
        res.raise_for_status()
        data = res.json()
        return {"status": "success", "data": data}
    except requests.exceptions.RequestException as e:
        return {"status": "failed", "error": str(e), "source": full_url}, 500


def getPodDetails():
    base_domain = os.getenv("domain")
    print(base_domain, "---")
    base_path = "/model/allocation"
    default_params = {
        "window": "7d",
        "accumulate": "true",
        "aggregate": "controller",
        "external": "false",
        "filterPods": "postgresql-0",
    }
    query_params = {
        key: request.args.get(key, default) for key, default in default_params.items()
    }

    query_string = "?" + "&".join(
        f"{key}={value}" for key, value in query_params.items()
    )
    full_url = f"{base_domain}{base_path}{query_string}"
    print(full_url, "---------")

    try:
        res = requests.get(full_url)
        res.raise_for_status()
        data = res.json()
        return {"status": "success", "data": data}
    except requests.exceptions.RequestException as e:
        return {"status": "failed", "error": str(e), "source": full_url}, 500


def get_node_info():
    return {"nodes": ["node1", "node2", "node3"]}
