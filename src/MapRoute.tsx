import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Navigation, Shield, AlertTriangle, Loader2, Clock, Route as RouteIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper to calculate distance between two coords in km
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
};

// Fix Leaflet default icon paths in React
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom icons for Start and End
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const nearbyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const userLocationIcon = L.divIcon({
  className: 'custom-user-location',
  html: `<div style="width: 16px; height: 16px; background-color: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function NavigationController({ currentPosition, isNavigating }: { currentPosition: [number, number] | null, isNavigating: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (isNavigating && currentPosition) {
      map.setView(currentPosition, 16, { animate: true });
    }
  }, [currentPosition, isNavigating, map]);
  return null;
}

// Component to automatically adjust map bounds to fit the route
function MapBounds({ route }: { route: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (route.length > 0) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [route, map]);
  return null;
}

export default function MapRoute() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  
  const state = routerLocation.state as { location: string; disasterType: string } | null;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string; destinationName: string; mapsUri?: string } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<{name: string, lat: number, lon: number}[]>([]);
  
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  useEffect(() => {
    if (!state || !state.location || !state.disasterType) {
      navigate('/');
      return;
    }

    const fetchRoute = async () => {
      try {
        // 1. Geocode the start location
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(state.location)}&limit=1`);
        const geoData = await geoRes.json();
        
        if (!geoData || geoData.length === 0) {
          throw new Error("Could not find the specified location on the map.");
        }

        const startLat = parseFloat(geoData[0].lat);
        const startLon = parseFloat(geoData[0].lon);
        setStartCoords([startLat, startLon]);

        // 2. Determine destination based on disaster type using Gemini + Google Maps
        let destLat = startLat;
        let destLon = startLon;
        let destName = "Safe Zone";
        let mapsUri = "";

        try {
          let specificInstructions = "Find the nearest and safest evacuation center, hospital, or designated safe zone.";
          if (state.disasterType === 'flood') {
            specificInstructions = "For a flood, you MUST find a high building or elevated structure that is far away from rivers or water bodies.";
          } else if (state.disasterType === 'earthquake') {
            specificInstructions = "For an earthquake, you MUST find an open ground, large park, or wide open space far away from tall buildings.";
          } else if (state.disasterType === 'wildfire') {
            specificInstructions = "For a wildfire, you MUST find the nearest major hospital or medical center that is far away from forests or any place which can catch fire easily.";
          }

          const prompt = `${specificInstructions} The emergency is a ${state.disasterType} near ${state.location}.
          You MUST provide the exact latitude and longitude of the primary destination.
          You MUST ALSO provide 2 to 4 other nearby hospitals, medical centers, or shelters.
          Reply strictly with this exact text format and nothing else:
          DEST_NAME: [Primary Name]
          DEST_LAT: [Primary Latitude]
          DEST_LON: [Primary Longitude]
          NEARBY: [Name 1] | [Lat 1] | [Lon 1]
          NEARBY: [Name 2] | [Lat 2] | [Lon 2]
          NEARBY: [Name 3] | [Lat 3] | [Lon 3]`;

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: {
                    latitude: startLat,
                    longitude: startLon
                  }
                }
              }
            }
          });

          const text = response.text || "";
          console.log("Gemini Map Response:", text);
          const cleanText = text.replace(/\*/g, '');
          const nameMatch = cleanText.match(/DEST_NAME:\s*([^\n]+)/);
          const latMatch = cleanText.match(/DEST_LAT:\s*([-\d.]+)/);
          const lonMatch = cleanText.match(/DEST_LON:\s*([-\d.]+)/);

          if (nameMatch && latMatch && lonMatch) {
            destName = nameMatch[1].trim();
            destLat = parseFloat(latMatch[1]);
            destLon = parseFloat(lonMatch[1]);
          } else {
            throw new Error("Failed to parse Gemini response: " + text);
          }

          const nearbyMatches = [...cleanText.matchAll(/NEARBY:\s*([^|]+)\|\s*([-\d.]+)\s*\|\s*([-\d.]+)/g)];
          const parsedNearby = nearbyMatches.map(m => ({
            name: m[1].trim(),
            lat: parseFloat(m[2]),
            lon: parseFloat(m[3])
          }));
          setNearbyPlaces(parsedNearby);

          const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (chunks) {
            for (const chunk of chunks) {
              if (chunk.maps?.uri) {
                mapsUri = chunk.maps.uri;
                break;
              }
            }
          }
        } catch (e) {
          console.warn("Gemini Maps request failed, using fallback:", e);
          // Fallback if no real-world places found
          if (state.disasterType === 'earthquake') {
            destLat -= 0.02; destLon += 0.02;
            destName = "Emergency Open Ground (Fallback)";
          } else {
            destLat += 0.05; destLon += 0.05;
            destName = "Designated Safe Zone (Fallback)";
          }
        }
        
        setEndCoords([destLat, destLon]);

        // 3. Get the driving route using OSRM (requesting alternatives to find the shortest distance)
        const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${destLon},${destLat}?overview=full&geometries=geojson&alternatives=true`);
        const osrmData = await osrmRes.json();

        if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
          throw new Error("Could not calculate a driving route to the destination.");
        }

        // OSRM defaults to the *fastest* route (optimizing for speed limits/highways).
        // We check the alternatives to explicitly pick the one with the *shortest* physical distance.
        const route = osrmData.routes.reduce((shortest: any, current: any) => {
          return current.distance < shortest.distance ? current : shortest;
        }, osrmData.routes[0]);
        
        // OSRM returns coordinates as [lon, lat], Leaflet needs [lat, lon]
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setRouteCoords(coordinates);

        // Convert distance (meters to km) and duration (seconds to minutes)
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);

        setRouteInfo({
          distance: `${distanceKm} km`,
          duration: `${durationMin} min`,
          destinationName: destName,
          mapsUri: mapsUri
        });

      } catch (err: any) {
        console.error("Map routing error:", err);
        setError(err.message || "Failed to generate evacuation map.");
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [state, navigate]);

  useEffect(() => {
    let watchId: number;

    if (isNavigating) {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setCurrentPosition([position.coords.latitude, position.coords.longitude]);
          },
          (err) => {
            console.error("Geolocation error:", err);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
      } else {
        alert("Geolocation is not supported by your browser.");
        setIsNavigating(false);
      }
    } else {
      setCurrentPosition(null);
    }

    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isNavigating]);

  if (loading) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 1.02, filter: "blur(5px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.98, filter: "blur(5px)" }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4"
      >
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Generating Evacuation Map...</h2>
        <p className="text-slate-500 mt-2">Finding the safest route away from the {state?.disasterType} zone.</p>
      </motion.div>
    );
  }

  if (error || !startCoords || !endCoords) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 1.02, filter: "blur(5px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.98, filter: "blur(5px)" }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4"
      >
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Routing Failed</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={() => navigate('/')}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            Go Back
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 1.02, filter: "blur(5px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 0.98, filter: "blur(5px)" }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="h-screen w-full relative flex flex-col md:flex-row bg-slate-100 overflow-hidden"
    >
      
      {/* Sidebar / Overlay Panel */}
      <div 
        className={`absolute bottom-0 left-0 right-0 md:relative md:top-0 md:left-0 md:right-0 z-[1000] md:z-10 md:w-96 bg-white/95 backdrop-blur-xl md:h-full shadow-[0_-10px_40px_rgba(0,0,0,0.1)] md:shadow-2xl rounded-t-3xl md:rounded-none flex flex-col border-t border-white/50 md:border-t-0 md:border-r md:border-slate-200 transition-all duration-300 ease-in-out ${
          isSidebarExpanded ? 'h-[85vh]' : 'h-[30vh]'
        } md:h-full`}
      >
        
        {/* Mobile Drag Handle */}
        <div 
          className="w-full flex justify-center pt-4 pb-2 md:hidden cursor-pointer"
          onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-4 pb-4 md:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Evacuation Route</h1>
              <p className="text-xs text-slate-500 capitalize">{state?.disasterType} Emergency</p>
            </div>
          </div>
          
          {/* Mobile Expand Toggle */}
          <button 
            className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-full"
            onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
          >
            <span className="text-xs font-bold uppercase tracking-wider">{isSidebarExpanded ? 'Hide' : 'Details'}</span>
          </button>
        </div>

        {/* Route Details */}
        <div className="p-4 md:p-6 flex-1 overflow-y-auto">
          
          <div className="relative pl-6 pb-6 border-l-2 border-dashed border-slate-300 ml-3 space-y-6">
            {/* Start Point */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-red-500 border-4 border-white shadow-sm" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Start Location</h3>
              <p className="text-sm font-semibold text-slate-900">{state?.location}</p>
              <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Hazard Zone
              </p>
            </div>

            {/* End Point */}
            <div className="relative">
              <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-sm" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Destination</h3>
              <p className="text-sm font-semibold text-slate-900">{routeInfo?.destinationName}</p>
              <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /> Safe Location
              </p>
              {routeInfo?.mapsUri && (
                <a href={routeInfo.mapsUri} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                  View on Google Maps
                </a>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex flex-col">
              <span className="text-blue-500 mb-1"><RouteIcon className="w-5 h-5" /></span>
              <span className="text-xs text-slate-500 font-medium">Distance</span>
              <span className="text-lg font-bold text-slate-800">{routeInfo?.distance}</span>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col">
              <span className="text-emerald-500 mb-1"><Clock className="w-5 h-5" /></span>
              <span className="text-xs text-slate-500 font-medium">Est. Time</span>
              <span className="text-lg font-bold text-slate-800">{routeInfo?.duration}</span>
            </div>
          </div>

          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" />
              Safety Instructions
            </h4>
            <ul className="text-xs text-amber-700 space-y-2 list-disc pl-4">
              <li>Follow the highlighted blue route immediately.</li>
              {state?.disasterType === 'wildfire' && (
                <li><strong>CRITICAL:</strong> Stay far away from forests, dry brush, or any place which can catch fire easily.</li>
              )}
              {state?.disasterType === 'flood' && (
                <li><strong>CRITICAL:</strong> Move to higher ground and avoid walking or driving through flood waters.</li>
              )}
              {state?.disasterType === 'earthquake' && (
                <li><strong>CRITICAL:</strong> Stay in open areas away from buildings, trees, streetlights, and utility wires.</li>
              )}
              <li>Do not attempt to gather belongings if time is critical.</li>
              <li>Listen to local authorities for real-time updates.</li>
            </ul>
          </div>

          {/* Map Legend */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Map Legend</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" alt="Red Marker" className="w-4 h-6 object-contain drop-shadow-sm" />
                <span className="text-sm font-medium text-slate-700"><strong>Red Icon:</strong> Hazard Zone (Start)</span>
              </div>
              <div className="flex items-center gap-3">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png" alt="Green Marker" className="w-4 h-6 object-contain drop-shadow-sm" />
                <span className="text-sm font-medium text-slate-700"><strong>Green Icon:</strong> Safe Zone (Destination)</span>
              </div>
              <div className="flex items-center gap-3">
                <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png" alt="Blue Marker" className="w-4 h-6 object-contain drop-shadow-sm" />
                <span className="text-sm font-medium text-slate-700"><strong>Blue Icon:</strong> Nearby Alternative Safe Zones</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-1.5 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium text-slate-700"><strong>Blue Line:</strong> Evacuation Route</span>
              </div>
            </div>
          </div>

          {/* Navigation Button */}
          <div className="mt-6 pb-6">
            <button
              onClick={() => setIsNavigating(!isNavigating)}
              className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all shadow-lg ${
                isNavigating 
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30'
              }`}
            >
              <Navigation className={`w-5 h-5 ${isNavigating ? '' : 'animate-pulse'}`} />
              {isNavigating ? 'Stop Navigation' : 'Start Navigation'}
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 h-full w-full relative z-0">
        <MapContainer 
          center={startCoords} 
          zoom={13} 
          className="w-full h-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          {routeCoords.length > 0 && (
            <>
              {/* Off-road path from start marker to the beginning of the road route */}
              <Polyline 
                positions={[startCoords, routeCoords[0]]} 
                color="#3b82f6" 
                weight={4} 
                opacity={0.8} 
                dashArray="8, 8"
                lineCap="round"
              />
              
              {/* Main driving route on the road network */}
              <Polyline 
                positions={routeCoords} 
                color="#3b82f6" 
                weight={6} 
                opacity={0.8} 
                lineCap="round"
                lineJoin="round"
              />

              {/* Off-road path from the end of the road route to the destination marker */}
              <Polyline 
                positions={[routeCoords[routeCoords.length - 1], endCoords]} 
                color="#3b82f6" 
                weight={4} 
                opacity={0.8} 
                dashArray="8, 8"
                lineCap="round"
              />

              <MapBounds route={[startCoords, ...routeCoords, endCoords]} />
            </>
          )}

          <Marker position={startCoords} icon={startIcon}>
            <Popup>
              <strong>Start:</strong> {state?.location} <br/>
              <span className="text-red-600">Hazard Zone</span>
            </Popup>
          </Marker>

          <Marker position={endCoords} icon={endIcon}>
            <Popup>
              <strong>Destination:</strong> {routeInfo?.destinationName} <br/>
              <span className="text-emerald-600">Safe Zone</span>
            </Popup>
          </Marker>

          {nearbyPlaces.map((place, idx) => (
            <Marker key={idx} position={[place.lat, place.lon]} icon={nearbyIcon}>
              <Popup>
                <strong>Nearby Safe Zone:</strong> {place.name} <br/>
                <span className="text-blue-600">Alternative Location</span>
              </Popup>
            </Marker>
          ))}

          {currentPosition && (
            <Marker position={currentPosition} icon={userLocationIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}
          
          <NavigationController currentPosition={currentPosition} isNavigating={isNavigating} />
        </MapContainer>
      </div>
    </motion.div>
  );
}
