import React, { useState } from 'react';
import { Shield, MapPin, Crosshair, AlertTriangle, ChevronDown, Send, HelpCircle, X, Loader2, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function App() {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [location, setLocation] = useState('');
  const [disasterType, setDisasterType] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Reverse geocoding using Nominatim
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          
          if (data && data.address) {
            const address = data.address;
            const city = address.city || address.town || address.village || address.county;
            const state = address.state;
            if (city && state) {
              setLocation(`${city}, ${state}`);
            } else {
              setLocation(data.display_name.split(',').slice(0, 2).join(','));
            }
          } else {
            setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (error) {
          console.error("Error fetching address:", error);
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to retrieve your location. Please check your permissions.");
        setIsLocating(false);
      }
    );
  };

  const handleGetPlan = () => {
    if (!location || !disasterType) {
      setError("Please enter your location and select a disaster type.");
      return;
    }

    setError(null);
    // Navigate to the map page, passing the location and disaster type
    navigate('/map', { state: { location, disasterType } });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, filter: "blur(5px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, scale: 1.02, filter: "blur(5px)" }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      className="min-h-screen relative flex flex-col items-center justify-center p-4 font-sans bg-slate-50"
    >
      {/* Map Background */}
      <div 
        className="fixed inset-0 z-0 bg-cover bg-center opacity-70"
        style={{ backgroundImage: 'url("https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Equirectangular_projection_SW.jpg/1920px-Equirectangular_projection_SW.jpg")' }}
      />

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center mt-8 mb-20 md:mt-0 md:mb-0">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-16 md:mb-24 text-center">
          {/* Title */}
          <div className="relative flex items-center justify-center w-full mb-2 md:mb-3 px-2">
             <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight drop-shadow-[0_0_15px_rgba(255,255,255,0.9)] flex flex-col sm:flex-row sm:gap-3">
              <span className="text-slate-900">Evacuation</span>
              <span className="text-blue-600">Optimizer</span>
            </h1>
          </div>
          
          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl text-slate-800 font-bold px-4 drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]">
            Find your safest evacuation route instantly
          </p>
        </div>

        {/* Input Card */}
        <div className="w-full bg-white/40 backdrop-blur-md rounded-3xl md:rounded-[2rem] p-5 sm:p-6 md:p-10 shadow-xl border border-white/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8">
            
            {/* Location Input */}
            <div className="flex flex-col space-y-2 md:space-y-3">
              <label className="text-xs md:text-sm font-bold text-blue-900 tracking-wide uppercase ml-1">Your Location</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-blue-500">
                  <MapPin className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter your location" 
                  className="w-full pl-11 md:pl-12 pr-12 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-base md:text-lg font-medium"
                />
                <button 
                  onClick={handleGetLocation}
                  disabled={isLocating}
                  className="absolute right-2 md:right-3 text-blue-600 hover:text-blue-700 p-2 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50"
                  title="Get current location"
                >
                  {isLocating ? (
                    <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  ) : (
                    <Crosshair className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Disaster Type Dropdown */}
            <div className="flex flex-col space-y-2 md:space-y-3">
              <label className="text-xs md:text-sm font-bold text-blue-900 tracking-wide uppercase ml-1">Disaster Type</label>
              <div className="relative flex items-center">
                <div className="absolute left-4 text-blue-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <select 
                  className="w-full pl-11 md:pl-12 pr-12 py-3.5 md:py-4 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-base md:text-lg font-medium cursor-pointer"
                  value={disasterType}
                  onChange={(e) => setDisasterType(e.target.value)}
                >
                  <option value="" disabled className="text-slate-500">Select disaster type</option>
                  <option value="wildfire" className="text-slate-900">Wildfire</option>
                  <option value="hurricane" className="text-slate-900">Hurricane</option>
                  <option value="flood" className="text-slate-900">Flood</option>
                  <option value="earthquake" className="text-slate-900">Earthquake</option>
                  <option value="landslide" className="text-slate-900">Landslide</option>
                </select>
                <div className="absolute right-4 text-blue-500 pointer-events-none">
                  <ChevronDown className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button 
            onClick={handleGetPlan}
            disabled={!location || !disasterType}
            className="w-full py-3.5 md:py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl md:rounded-2xl flex items-center justify-center space-x-2 transition-colors text-base md:text-lg shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
            <span>Get Evacuation Plan</span>
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium text-center">
              {error}
            </div>
          )}
        </div>

        {/* Page Footer */}
        <div className="mt-8 md:mt-12 flex flex-col sm:flex-row items-center justify-center gap-2 sm:space-x-2 text-slate-500 text-xs sm:text-sm font-bold text-center px-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        </div>
      </div>

      {/* Help Button */}
      <button 
        onClick={() => setIsHelpOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 p-3 bg-white/40 backdrop-blur-md hover:bg-white/80 text-blue-600 rounded-full border border-white/50 shadow-lg transition-colors z-40"
      >
        <HelpCircle className="w-5 h-5 md:w-6 md:h-6" />
      </button>

      {/* Help Popover */}
      <AnimatePresence>
        {isHelpOpen && (
          <>
            {/* Invisible Backdrop for closing when clicking outside */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsHelpOpen(false)}
            />
            
            {/* Popover Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0, y: 20, x: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 0, y: 20, x: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{ originX: 1, originY: 1 }}
              className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[380px] bg-white/40 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/50"
            >
              <button 
              onClick={() => setIsHelpOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            
            <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              About the Project
            </h2>
            
            <div className="space-y-3 text-slate-700 text-sm leading-relaxed">
              <p>
                <strong>Evacuation Optimizer</strong> is an intelligent routing platform designed to help communities navigate to safety during natural disasters.
              </p>
              <p>
                By aggregating real-time emergency management data, the system calculates the safest and most efficient evacuation paths away from active hazard zones like wildfires, floods, hurricanes, and earthquakes.
              </p>
              
              <div className="pt-4 mt-4 border-t border-slate-200/60">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Developed By</h3>
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px]">AG</div>
                    <span className="font-semibold text-slate-800 text-sm">Aryan Gupta</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-[10px]">VG</div>
                    <span className="font-semibold text-slate-800 text-sm">Vatsall Gandhi</span>
                  </div>
                </div>
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
