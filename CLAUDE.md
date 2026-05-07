# NATS Matrimony — Claude Instructions

## Project Overview

Full-stack matrimony platform for the North America Telugu Society (NATS).

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL (`backend/`)
- **Frontend**: React + Vite (`frontend/src/`)
- **Seed data**: 50 mock profiles with preferences (`backend/seed.py`)
- **Uploads**: Profile photos served from `backend/uploads/profiles/`

## Graphify — Mandatory Codebase Navigation

**A knowledge graph of this codebase already exists at `graphify-out/graph.json`.**

Before reading any source file or exploring the codebase, you MUST query the graph first:

```powershell
python -c "
import sys, json
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

question = 'YOUR_QUESTION_HERE'
terms = [t.lower() for t in question.split() if len(t) > 3]

scored = []
for nid, ndata in G.nodes(data=True):
    label = ndata.get('label', '').lower()
    score = sum(1 for t in terms if t in label)
    if score > 0:
        scored.append((score, nid))
scored.sort(reverse=True)
start_nodes = [nid for _, nid in scored[:3]]

subgraph_nodes = set(start_nodes)
frontier = set(start_nodes)
for _ in range(3):
    next_frontier = set()
    for n in frontier:
        for neighbor in G.neighbors(n):
            if neighbor not in subgraph_nodes:
                next_frontier.add(neighbor)
    subgraph_nodes.update(next_frontier)
    frontier = next_frontier

for nid in subgraph_nodes:
    d = G.nodes[nid]
    print('NODE', d.get('label', nid), '[', d.get('source_file',''), d.get('source_location',''), ']')
for u, v in G.edges(subgraph_nodes):
    if u in subgraph_nodes and v in subgraph_nodes:
        d = G.edges[u, v]
        print('EDGE', G.nodes[u].get('label',u), '--' + d.get('relation','') + '-->', G.nodes[v].get('label',v), '[' + d.get('confidence','') + ']')
"
```

Or use `/graphify query "your question"` for a guided traversal.

### When to use the graph vs. reading files

| Task | Use |
|------|-----|
| Understanding how two modules relate | `graphify query` first |
| Finding which file defines a function | Graph node lookup |
| Checking call chains or dependencies | BFS/DFS traversal |
| Reading implementation details | Read the file AFTER graph lookup |
| Adding a new feature | Query graph for affected nodes first |
| Debugging a bug across files | Trace path in graph, then read files |

**Only open a source file after the graph has told you which file and line to look at.**

## Architecture (from graph)

### God Nodes (highest coupling — touch carefully)
- `Profile` — 19 edges, bridges Models / Auth / Schemas / Wishlist / Match
- `Preference` — 13 edges, central to match scoring
- `Interest` — 12 edges, drives contact reveal logic
- `profile_to_response()` — 9 edges, sole serialization path

### Communities
| Community | Key files |
|-----------|-----------|
| Database Models & Match Engine | `models.py`, `matches.py`, `seed.py` |
| Authentication Routes | `routes/auth.py` |
| Profile & Wishlist Routes | `routes/profiles.py`, `routes/wishlists.py` |
| Interest Management Routes | `routes/interests.py` |
| Pydantic Schema Validation | `schemas.py` |
| Profile API Service Layer | `ProfileCard.jsx`, `ProfileDetail.jsx` |
| Frontend Entry & HTTP Client | `main.jsx`, `data/api.js`, `index.html` |
| App Router & Auth Guard | `App.jsx` |

### Known Cross-Community Surprises
- Auth routes touch `Profile` directly — no separate User model exists
- `profile_to_response()` is the single serialization bridge between DB models and all frontend-facing routes

## Keeping the Graph Fresh

After editing code files, regenerate the graph:
```
/graphify . --update
```

After adding new docs or major features:
```
/graphify .
```
