#include <iostream>
#include <vector>
#include <string>
#include <queue>
#include <unordered_map>
#include <limits>
#include <fstream>
#include <sstream>

using namespace std;

const int INF = numeric_limits<int>::max();

// A simple graph representation
struct Edge {
    int to;
    int weight;
};

// Mock map data for demonstration
unordered_map<string, int> locationToIndex = {
    {"City Center", 0},
    {"North Suburb", 1},
    {"South Suburb", 2},
    {"East Suburb", 3},
    {"West Suburb", 4},
    {"General Hospital", 5},
    {"Safe Zone Alpha", 6}
};

unordered_map<int, string> indexToLocation = {
    {0, "City Center"},
    {1, "North Suburb"},
    {2, "South Suburb"},
    {3, "East Suburb"},
    {4, "West Suburb"},
    {5, "General Hospital"},
    {6, "Safe Zone Alpha"}
};

// Create a mock graph (adjacency list)
vector<vector<Edge>> createGraph() {
    int n = 7; // Number of nodes
    vector<vector<Edge>> graph(n);

    // Add edges (bidirectional for simplicity)
    graph[0].push_back({1, 5});
    graph[1].push_back({0, 5});

    graph[0].push_back({2, 8});
    graph[2].push_back({0, 8});

    graph[0].push_back({3, 4});
    graph[3].push_back({0, 4});

    graph[0].push_back({4, 6});
    graph[4].push_back({0, 6});

    graph[1].push_back({5, 3}); // North Suburb to Hospital
    graph[5].push_back({1, 3});

    graph[3].push_back({5, 7}); // East Suburb to Hospital
    graph[5].push_back({3, 7});

    graph[2].push_back({6, 4}); // South Suburb to Safe Zone
    graph[6].push_back({2, 4});

    graph[4].push_back({6, 9}); // West Suburb to Safe Zone
    graph[6].push_back({4, 9});

    return graph;
}

// Dijkstra's Algorithm
pair<int, vector<int>> dijkstra(const vector<vector<Edge>>& graph, int start, int end) {
    int n = graph.size();
    vector<int> dist(n, INF);
    vector<int> parent(n, -1);
    
    // Min-heap priority queue: {distance, node}
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;

    dist[start] = 0;
    pq.push({0, start});

    while (!pq.empty()) {
        int d = pq.top().first;
        int u = pq.top().second;
        pq.pop();

        if (d > dist[u]) continue;

        if (u == end) break; // Reached destination

        for (const Edge& edge : graph[u]) {
            int v = edge.to;
            int weight = edge.weight;

            if (dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
                parent[v] = u;
                pq.push({dist[v], v});
            }
        }
    }

    // Reconstruct path
    vector<int> path;
    if (dist[end] != INF) {
        for (int curr = end; curr != -1; curr = parent[curr]) {
            path.push_back(curr);
        }
        // Reverse the path to get start -> end
        int left = 0, right = path.size() - 1;
        while (left < right) {
            swap(path[left], path[right]);
            left++;
            right--;
        }
    }

    return {dist[end], path};
}

// Simple hash function to map arbitrary strings to our mock nodes
int mapLocationToNode(const string& loc) {
    // If it's a known location, return it
    if (locationToIndex.find(loc) != locationToIndex.end()) {
        return locationToIndex[loc];
    }
    
    // Otherwise, hash it to one of the suburbs (1-4) or city center (0)
    int hash = 0;
    for (char c : loc) {
        hash += c;
    }
    return hash % 5; 
}

int main(int argc, char* argv[]) {
    if (argc < 2) {
        cout << "{\"error\": \"Missing input file argument\"}" << endl;
        return 1;
    }

    string inputFile = argv[1];
    ifstream file(inputFile);
    
    if (!file.is_open()) {
        cout << "{\"error\": \"Could not open input file\"}" << endl;
        return 1;
    }

    string location, disasterType;
    getline(file, location);
    getline(file, disasterType);
    file.close();

    // Clean up input strings (remove carriage returns if any)
    if (!location.empty() && location.back() == '\r') location.pop_back();
    if (!disasterType.empty() && disasterType.back() == '\r') disasterType.pop_back();

    vector<vector<Edge>> graph = createGraph();

    int startNode = mapLocationToNode(location);
    
    // Determine destination based on disaster type
    int endNode;
    if (disasterType == "wildfire" || disasterType == "flood") {
        endNode = locationToIndex["Safe Zone Alpha"]; // Go to safe zone
    } else {
        endNode = locationToIndex["General Hospital"]; // Go to hospital
    }

    // If start is the same as end, pick the other one just to show a path
    if (startNode == endNode) {
        endNode = (endNode == locationToIndex["Safe Zone Alpha"]) ? locationToIndex["General Hospital"] : locationToIndex["Safe Zone Alpha"];
    }

    pair<int, vector<int>> result = dijkstra(graph, startNode, endNode);

    // Output JSON
    cout << "{" << endl;
    cout << "  \"startLocation\": \"" << location << "\"," << endl;
    cout << "  \"mappedStartNode\": \"" << indexToLocation[startNode] << "\"," << endl;
    cout << "  \"destination\": \"" << indexToLocation[endNode] << "\"," << endl;
    
    if (result.first == INF) {
        cout << "  \"status\": \"No path found\"," << endl;
        cout << "  \"distance\": -1," << endl;
        cout << "  \"path\": []" << endl;
    } else {
        cout << "  \"status\": \"Success\"," << endl;
        cout << "  \"distance\": " << result.first << "," << endl;
        
        cout << "  \"path\": [";
        for (size_t i = 0; i < result.second.size(); ++i) {
            cout << "\"" << indexToLocation[result.second[i]] << "\"";
            if (i < result.second.size() - 1) cout << ", ";
        }
        cout << "]" << endl;
    }
    cout << "}" << endl;

    return 0;
}
