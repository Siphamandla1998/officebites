import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const LocationContext = createContext(null);

const GEO_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 5 * 60 * 1000,
};

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      const message =
        "Location services are not supported by this browser.";

      setStatus("unsupported");
      setError(message);

      return Promise.resolve(null);
    }

    setStatus("requesting");
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: Date.now(),
          };

          setLocation(nextLocation);
          setStatus("ready");

          resolve(nextLocation);
        },

        (geoError) => {
          let message =
            "We couldn't determine your current location.";

          if (geoError.code === geoError.PERMISSION_DENIED) {
            message =
              "Location permission was denied. You can still browse all OfficeBites vendors.";
            setStatus("denied");
          } else if (
            geoError.code === geoError.POSITION_UNAVAILABLE
          ) {
            message =
              "Your current location is unavailable. You can still browse all vendors.";
            setStatus("unavailable");
          } else if (geoError.code === geoError.TIMEOUT) {
            message =
              "Location lookup took too long. You can try again.";
            setStatus("timeout");
          } else {
            setStatus("error");
          }

          setError(message);
          resolve(null);
        },

        GEO_OPTIONS
      );
    });
  }, []);

  const clearLocation = useCallback(() => {
    setLocation(null);
    setStatus("idle");
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      location,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      accuracy: location?.accuracy ?? null,

      status,
      error,

      hasLocation:
        Number.isFinite(location?.latitude) &&
        Number.isFinite(location?.longitude),

      requesting: status === "requesting",

      requestLocation,
      clearLocation,
    }),
    [location, status, error, requestLocation, clearLocation]
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error(
      "useLocation must be used within LocationProvider"
    );
  }

  return context;
}