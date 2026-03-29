import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { exec } from "child_process";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Dijkstra's Algorithm
  app.post("/api/route", async (req, res) => {
    const { location, disasterType } = req.body;

    if (!location || !disasterType) {
      return res.status(400).json({ error: "Location and disaster type are required." });
    }

    try {
      // Mock map data
      const locationToIndex: Record<string, number> = {
          "City Center": 0,
          "North Suburb": 1,
          "South Suburb": 2,
          "East Suburb": 3,
          "West Suburb": 4,
          "General Hospital": 5,
          "Safe Zone Alpha": 6
      };

      const indexToLocation: Record<number, string> = {
          0: "City Center",
          1: "North Suburb",
          2: "South Suburb",
          3: "East Suburb",
          4: "West Suburb",
          5: "General Hospital",
          6: "Safe Zone Alpha"
      };

      type Edge = { to: number; weight: number };
      const graph: Edge[][] = Array.from({ length: 7 }, () => []);

      // Add edges (bidirectional)
      graph[0].push({ to: 1, weight: 5 });
      graph[1].push({ to: 0, weight: 5 });

      graph[0].push({ to: 2, weight: 8 });
      graph[2].push({ to: 0, weight: 8 });

      graph[0].push({ to: 3, weight: 4 });
      graph[3].push({ to: 0, weight: 4 });

      graph[0].push({ to: 4, weight: 6 });
      graph[4].push({ to: 0, weight: 6 });

      graph[1].push({ to: 5, weight: 3 }); // North Suburb to Hospital
      graph[5].push({ to: 1, weight: 3 });

      graph[3].push({ to: 5, weight: 7 }); // East Suburb to Hospital
      graph[5].push({ to: 3, weight: 7 });

      graph[2].push({ to: 6, weight: 4 }); // South Suburb to Safe Zone
      graph[6].push({ to: 2, weight: 4 });

      graph[4].push({ to: 6, weight: 9 }); // West Suburb to Safe Zone
      graph[6].push({ to: 4, weight: 9 });

      // Simple hash function to map arbitrary strings to our mock nodes
      let startNode = 0;
      if (locationToIndex[location] !== undefined) {
          startNode = locationToIndex[location];
      } else {
          let hash = 0;
          for (let i = 0; i < location.length; i++) {
              hash += location.charCodeAt(i);
          }
          startNode = hash % 5;
      }

      // Determine destination based on disaster type
      let endNode = (disasterType === "wildfire" || disasterType === "flood") 
          ? locationToIndex["Safe Zone Alpha"] 
          : locationToIndex["General Hospital"];

      if (startNode === endNode) {
          endNode = (endNode === locationToIndex["Safe Zone Alpha"]) 
              ? locationToIndex["General Hospital"] 
              : locationToIndex["Safe Zone Alpha"];
      }

      // Dijkstra's Algorithm in TypeScript
      const INF = Number.MAX_SAFE_INTEGER;
      const dist = new Array(7).fill(INF);
      const parent = new Array(7).fill(-1);
      const visited = new Array(7).fill(false);

      dist[startNode] = 0;

      for (let i = 0; i < 7; i++) {
          let u = -1;
          let minDist = INF;
          for (let j = 0; j < 7; j++) {
              if (!visited[j] && dist[j] < minDist) {
                  minDist = dist[j];
                  u = j;
              }
          }

          if (u === -1 || u === endNode) break;
          visited[u] = true;

          for (const edge of graph[u]) {
              const v = edge.to;
              const weight = edge.weight;
              if (!visited[v] && dist[u] + weight < dist[v]) {
                  dist[v] = dist[u] + weight;
                  parent[v] = u;
              }
          }
      }

      const path: string[] = [];
      if (dist[endNode] !== INF) {
          for (let curr = endNode; curr !== -1; curr = parent[curr]) {
              path.push(indexToLocation[curr]);
          }
          path.reverse();
      }

      const result = {
          startLocation: location,
          mappedStartNode: indexToLocation[startNode],
          destination: indexToLocation[endNode],
          status: dist[endNode] === INF ? "No path found" : "Success",
          distance: dist[endNode] === INF ? -1 : dist[endNode],
          path: path
      };

      res.json(result);
    } catch (error) {
      console.error("Routing error:", error);
      res.status(500).json({ error: "Failed to calculate route." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
