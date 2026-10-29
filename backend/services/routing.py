"""
Routing Engine — Dijkstra-based shortest-path routing with dynamic link costs.

Link costs incorporate latency, packet loss, congestion, and utilization so that
the routing engine automatically avoids degraded or failed links.
"""

import heapq
from typing import Dict, List, Optional, Tuple, Set
from models.network import NetworkLink, LinkStatus, NetworkDevice, DeviceStatus


class RoutingEngine:
    """
    Implements Dijkstra's shortest-path algorithm with composite link costs.
    
    Cost Formula:
        cost = base_cost + (latency_weight * latency)
               + (loss_weight * packet_loss)
               + (congestion_weight * utilization)
    
    Failed links and failed/shut-down devices are excluded from the graph automatically.
    """

    LATENCY_WEIGHT = 0.3
    LOSS_WEIGHT = 2.0
    CONGESTION_WEIGHT = 0.5

    def __init__(self):
        pass

    def build_graph(
        self, links: List[NetworkLink], failed_devices: Optional[Set[str]] = None
    ) -> Dict[str, List[Tuple[str, float, str]]]:
        """
        Build an adjacency list from active links.
        Each entry: node -> [(neighbor, cost, link_id), ...]
        Failed links and links connected to failed/shut-down devices are excluded.
        """
        graph: Dict[str, List[Tuple[str, float, str]]] = {}
        failed_devs = failed_devices or set()

        for link in links:
            if link.status == LinkStatus.FAILED:
                continue  # Exclude failed links from routing
            if link.source in failed_devs or link.target in failed_devs:
                continue  # Exclude links connected to shut-down/failed devices

            cost = self._calculate_cost(link)

            # Bidirectional link
            graph.setdefault(link.source, []).append((link.target, cost, link.id))
            graph.setdefault(link.target, []).append((link.source, cost, link.id))

        return graph

    def _calculate_cost(self, link: NetworkLink) -> float:
        """
        Calculate composite routing cost for a link.
        Higher cost = less desirable path.
        """
        base = link.cost if link.cost > 0 else 1.0
        latency_penalty = self.LATENCY_WEIGHT * link.latency
        loss_penalty = self.LOSS_WEIGHT * link.packet_loss
        congestion_penalty = self.CONGESTION_WEIGHT * (link.utilization / 100.0)

        total_cost = base + latency_penalty + loss_penalty + congestion_penalty

        # Degraded links get an additional penalty
        if link.status == LinkStatus.DEGRADED:
            total_cost *= 1.5

        return max(0.1, total_cost)

    def dijkstra(
        self, graph: Dict[str, List[Tuple[str, float, str]]],
        source: str, target: str
    ) -> Optional[Tuple[List[str], float]]:
        """
        Run Dijkstra's algorithm from source to target.
        Returns (path_as_list_of_node_ids, total_cost) or None if unreachable.
        """
        if source not in graph:
            return None

        # dist[node] = shortest distance found so far
        dist: Dict[str, float] = {source: 0.0}
        prev: Dict[str, Optional[str]] = {source: None}
        visited = set()
        # Priority queue: (cost, node)
        pq = [(0.0, source)]

        while pq:
            current_cost, current = heapq.heappop(pq)

            if current in visited:
                continue
            visited.add(current)

            if current == target:
                # Reconstruct path
                path = []
                node = target
                while node is not None:
                    path.append(node)
                    node = prev.get(node)
                return (list(reversed(path)), current_cost)

            for neighbor, edge_cost, _link_id in graph.get(current, []):
                if neighbor in visited:
                    continue
                new_cost = current_cost + edge_cost
                if new_cost < dist.get(neighbor, float('inf')):
                    dist[neighbor] = new_cost
                    prev[neighbor] = current
                    heapq.heappush(pq, (new_cost, neighbor))

        return None  # Target is unreachable

    def find_path(
        self, links: List[NetworkLink], source: str, target: str,
        failed_devices: Optional[Set[str]] = None
    ) -> Optional[Tuple[List[str], float]]:
        """Convenience: build graph then find shortest path, excluding failed devices."""
        failed_devs = failed_devices or set()
        if source in failed_devs or target in failed_devs:
            return None
        graph = self.build_graph(links, failed_devices=failed_devs)
        return self.dijkstra(graph, source, target)

    def find_alternate_paths(
        self, links: List[NetworkLink], source: str, target: str,
        excluded_links: Optional[List[str]] = None, max_paths: int = 3,
        failed_devices: Optional[Set[str]] = None
    ) -> List[Tuple[List[str], float]]:
        """
        Find up to `max_paths` alternate paths, optionally excluding certain links and failed devices.
        Uses a K-shortest-paths style approach (Yen's algorithm simplified).
        """
        failed_devs = failed_devices or set()
        if source in failed_devs or target in failed_devs:
            return []

        # Filter out excluded links
        available_links = links
        if excluded_links:
            available_links = [l for l in links if l.id not in excluded_links]

        graph = self.build_graph(available_links, failed_devices=failed_devs)
        result = self.dijkstra(graph, source, target)
        if result is None:
            return []

        paths = [result]

        # Simple approach: try removing each edge of the best path to find alternatives
        best_path, _ = result
        for i in range(len(best_path) - 1):
            lid1 = f"{best_path[i]}-{best_path[i+1]}"
            lid2 = f"{best_path[i+1]}-{best_path[i]}"
            # Exclude this edge
            filtered = [l for l in available_links if l.id != lid1 and l.id != lid2]
            g2 = self.build_graph(filtered, failed_devices=failed_devs)
            alt = self.dijkstra(g2, source, target)
            if alt and alt not in paths:
                paths.append(alt)
            if len(paths) >= max_paths:
                break

        return paths

    def get_path_details(
        self, links: List[NetworkLink], path: List[str]
    ) -> Dict:
        """Get detailed info about a specific path."""
        link_map = {l.id: l for l in links}
        total_latency = 0.0
        total_loss = 0.0
        total_cost = 0.0
        path_links = []

        for i in range(len(path) - 1):
            lid1 = f"{path[i]}-{path[i+1]}"
            lid2 = f"{path[i+1]}-{path[i]}"
            lid = lid1 if lid1 in link_map else lid2 if lid2 in link_map else None
            if lid and lid in link_map:
                link = link_map[lid]
                total_latency += link.latency
                total_loss += link.packet_loss
                total_cost += self._calculate_cost(link)
                path_links.append(lid)

        return {
            "path": path,
            "links": path_links,
            "total_latency": total_latency,
            "total_packet_loss": total_loss,
            "total_cost": total_cost,
            "hop_count": len(path) - 1,
        }

    def compute_routing_table(
        self, router_id: str, devices: Dict[str, NetworkDevice], links: List[NetworkLink]
    ) -> List[Dict]:
        """
        Derive dynamic routing table for a given router from the authoritative topology.
        Failed/shut-down routers or servers are excluded as hops or destinations.
        """
        router = devices.get(router_id)
        if not router:
            return []

        # Find all failed/powered-off devices
        failed_devs = {
            did for did, d in devices.items()
            if d.status == DeviceStatus.FAILED or not getattr(d, 'is_powered_on', True)
        }

        # If this router itself is failed/shut down, all routes are UNREACHABLE
        is_self_failed = router_id in failed_devs

        # Map neighbor device -> interface name on this router
        interface_map = {}
        for port in getattr(router, 'ports', []):
            interface_map[port.connected_device_id] = port.name

        graph = self.build_graph(links, failed_devices=failed_devs) if not is_self_failed else {}

        table = []
        for dest_id, dest_dev in devices.items():
            if dest_id == router_id:
                continue

            dest_name = dest_dev.name
            dest_ip = dest_dev.ip_address

            if is_self_failed or dest_id in failed_devs:
                table.append({
                    "destination_id": dest_id,
                    "destination_name": dest_name,
                    "destination_ip": dest_ip,
                    "next_hop_id": None,
                    "next_hop_name": None,
                    "next_hop_ip": None,
                    "interface": None,
                    "path_cost": None,
                    "hops": 0,
                    "status": "UNREACHABLE",
                    "path": [],
                })
                continue

            result = self.dijkstra(graph, router_id, dest_id)
            if result:
                path, cost = result
                next_hop_id = path[1] if len(path) > 1 else None
                next_hop_dev = devices.get(next_hop_id)
                interface_name = interface_map.get(next_hop_id)
                if not interface_name and next_hop_id:
                    interface_name = f"if-{next_hop_id}"
                hops = len(path) - 1
                status = "DIRECT" if hops == 1 else "ACTIVE"

                table.append({
                    "destination_id": dest_id,
                    "destination_name": dest_name,
                    "destination_ip": dest_ip,
                    "next_hop_id": next_hop_id,
                    "next_hop_name": next_hop_dev.name if next_hop_dev else next_hop_id,
                    "next_hop_ip": next_hop_dev.ip_address if next_hop_dev else "",
                    "interface": interface_name,
                    "path_cost": round(cost, 2),
                    "hops": hops,
                    "status": status,
                    "path": path,
                })
            else:
                table.append({
                    "destination_id": dest_id,
                    "destination_name": dest_name,
                    "destination_ip": dest_ip,
                    "next_hop_id": None,
                    "next_hop_name": None,
                    "next_hop_ip": None,
                    "interface": None,
                    "path_cost": None,
                    "hops": 0,
                    "status": "UNREACHABLE",
                    "path": [],
                })

        return table

