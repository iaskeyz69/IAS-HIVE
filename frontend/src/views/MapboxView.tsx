import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { severityColor } from "../lib/colors";
import { greatCircle } from "../lib/geo";
import type { BasemapId, HiveEvent, LiveArc, SensorStatus } from "../types";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const STYLES: Record<BasemapId, string> = {
  satellite: "mapbox://styles/mapbox/satellite-streets-v12",
  normal: "mapbox://styles/mapbox/navigation-night-v1",
};
const DEM = "mapbox-dem";
const BUILDINGS = "3d-buildings";

type SensorCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string; color: string; label: string };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

function sensorsGeo(sensors: SensorStatus[]): SensorCollection {
  return {
    type: "FeatureCollection",
    features: sensors.map((sensor) => ({
      type: "Feature",
      properties: {
        id: sensor.id,
        color: sensor.online ? "#00D4FF" : "#FF4D4D",
        label: sensor.label,
      },
      geometry: { type: "Point", coordinates: [sensor.lon, sensor.lat] },
    })),
  };
}

type ArcCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string; color: string };
    geometry: { type: "LineString"; coordinates: [number, number][] };
  }[];
};

function locatedEvents(items: HiveEvent[]): HiveEvent[] {
  const seen = new Set<string>();
  const out: HiveEvent[] = [];
  for (const item of items) {
    if (item.src_lat == null || item.src_lon == null || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out.slice(0, 200);
}

function arcsGeo(items: HiveEvent[]): ArcCollection {
  return {
    type: "FeatureCollection",
    features: locatedEvents(items).map((arc) => ({
      type: "Feature",
      properties: { id: arc.id, color: severityColor(arc.severity) },
      geometry: {
        type: "LineString",
        coordinates: greatCircle(
          [arc.src_lon as number, arc.src_lat as number],
          [arc.sensor_lon, arc.sensor_lat],
        ),
      },
    })),
  };
}

type AttackCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string; color: string };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

function attackersGeo(items: HiveEvent[]): AttackCollection {
  return {
    type: "FeatureCollection",
    features: locatedEvents(items).map((arc) => ({
      type: "Feature",
      properties: { id: arc.id, color: severityColor(arc.severity) },
      geometry: { type: "Point", coordinates: [arc.src_lon as number, arc.src_lat as number] },
    })),
  };
}

function applyMode(map: mapboxgl.Map, mode: "2d" | "3d") {
  map.setProjection(mode === "3d" ? "globe" : "mercator");
  if (mode === "3d") {
    if (!map.getSource(DEM)) {
      map.addSource(DEM, {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });
    }
    map.setTerrain({ source: DEM, exaggeration: 1.15 });
    map.setFog(
      {
            color: "rgb(8, 10, 16)",
            "high-color": "rgb(0, 50, 70)",
            "horizon-blend": 0.12,
            "space-color": "rgb(3, 4, 8)",
            "star-intensity": 0.45,
          },
    );
    if (!map.getLayer(BUILDINGS)) {
      try {
        const layers = map.getStyle().layers ?? [];
        const label = layers.find((layer) => layer.type === "symbol" && layer.layout && "text-field" in layer.layout);
        map.addLayer(
          {
            id: BUILDINGS,
            source: "composite",
            "source-layer": "building",
            filter: ["==", ["get", "extrude"], "true"],
            type: "fill-extrusion",
            minzoom: 14,
            paint: {
              "fill-extrusion-color": "#1a2228",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.55,
            },
          },
          label?.id,
        );
      } catch {
        /* style may not expose a building source */
      }
    } else {
      map.setLayoutProperty(BUILDINGS, "visibility", "visible");
    }
    map.easeTo({ pitch: 60, duration: 700 });
    return;
  }

  map.setTerrain(null);
  map.setFog(null);
  if (map.getLayer(BUILDINGS)) {
    map.setLayoutProperty(BUILDINGS, "visibility", "none");
  }
  map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
}

function attachHiveLayers(map: mapboxgl.Map, sensors: SensorStatus[], items: HiveEvent[]) {
  if (!map.getSource("sensors")) {
    map.addSource("sensors", { type: "geojson", data: sensorsGeo(sensors) });
  } else {
    (map.getSource("sensors") as mapboxgl.GeoJSONSource).setData(sensorsGeo(sensors));
  }
  if (!map.getSource("arcs")) {
    map.addSource("arcs", { type: "geojson", data: arcsGeo(items) });
  } else {
    (map.getSource("arcs") as mapboxgl.GeoJSONSource).setData(arcsGeo(items));
  }
  if (!map.getSource("attackers")) {
    map.addSource("attackers", { type: "geojson", data: attackersGeo(items) });
  } else {
    (map.getSource("attackers") as mapboxgl.GeoJSONSource).setData(attackersGeo(items));
  }
  if (!map.getLayer("arcs-line")) {
    map.addLayer({
      id: "arcs-line",
      type: "line",
      source: "arcs",
      paint: {
        "line-color": ["get", "color"],
        "line-width": 1.6,
        "line-opacity": 0.85,
      },
    });
  }
  if (!map.getLayer("attackers-glow")) {
    map.addLayer({
      id: "attackers-glow",
      type: "circle",
      source: "attackers",
      paint: {
        "circle-radius": 9,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.22,
      },
    });
  }
  if (!map.getLayer("attackers-point")) {
    map.addLayer({
      id: "attackers-point",
      type: "circle",
      source: "attackers",
      paint: {
        "circle-radius": 4.5,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 1,
        "circle-stroke-color": "#00D4FF",
      },
    });
  }
  if (!map.getLayer("sensors-glow")) {
    map.addLayer({
      id: "sensors-glow",
      type: "circle",
      source: "sensors",
      paint: {
        "circle-radius": 10,
        "circle-color": ["get", "color"],
        "circle-opacity": 0.18,
      },
    });
  }
  if (!map.getLayer("sensors-point")) {
    map.addLayer({
      id: "sensors-point",
      type: "circle",
      source: "sensors",
      paint: {
        "circle-radius": 5,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 1.2,
        "circle-stroke-color": "#00D4FF",
      },
    });
  }
}

export function MapboxView({
  mode,
  basemap,
  sensors,
  arcs,
  events = [],
  focus,
  onSensor,
  onEvent,
}: {
  mode: "2d" | "3d";
  basemap: BasemapId;
  sensors: SensorStatus[];
  arcs: LiveArc[];
  events?: HiveEvent[];
  focus: HiveEvent | null;
  onSensor: (sensor: SensorStatus) => void;
  onEvent: (event: HiveEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sensorsRef = useRef(sensors);
  const arcsRef = useRef(arcs);
  const eventsRef = useRef(events);
  const mapItems = () => [...eventsRef.current, ...arcsRef.current];
  const onSensorRef = useRef(onSensor);
  const onEventRef = useRef(onEvent);
  const modeRef = useRef(mode);
  const basemapRef = useRef(basemap);
  sensorsRef.current = sensors;
  arcsRef.current = arcs;
  eventsRef.current = events;
  onSensorRef.current = onSensor;
  onEventRef.current = onEvent;
  modeRef.current = mode;

  useEffect(() => {
    if (!TOKEN || !host.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;
    const first = sensorsRef.current[0];
    const map = new mapboxgl.Map({
      container: host.current,
      style: STYLES[basemapRef.current],
      center: first ? [first.lon, first.lat] : [101.73, 3.17],
      zoom: 2.1,
      pitch: 60,
      bearing: 0,
      projection: "globe",
      attributionControl: false,
      logoPosition: "bottom-left",
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    const onLoad = () => {
      attachHiveLayers(map, sensorsRef.current, mapItems());
      applyMode(map, modeRef.current);
    };

    map.on("load", onLoad);
    map.on("click", "sensors-point", (ev) => {
      const raw = ev.features?.[0];
      const id = raw && "properties" in raw ? (raw.properties as { id?: string } | null)?.id : undefined;
      const match = sensorsRef.current.find((s) => s.id === id);
      if (match) onSensorRef.current(match);
    });
    map.on("click", "arcs-line", (ev) => {
      const raw = ev.features?.[0];
      const id = raw && "properties" in raw ? (raw.properties as { id?: string } | null)?.id : undefined;
      const match = mapItems().find((a) => a.id === id);
      if (match) onEventRef.current(match);
    });
    map.on("click", "attackers-point", (ev) => {
      const raw = ev.features?.[0];
      const id = raw && "properties" in raw ? (raw.properties as { id?: string } | null)?.id : undefined;
      const match = mapItems().find((a) => a.id === id);
      if (match) onEventRef.current(match);
    });
    map.on("mouseenter", "sensors-point", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "sensors-point", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "arcs-line", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "arcs-line", () => {
      map.getCanvas().style.cursor = "";
    });
    map.on("mouseenter", "attackers-point", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "attackers-point", () => {
      map.getCanvas().style.cursor = "";
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(host.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (basemapRef.current === basemap) return;
    basemapRef.current = basemap;
    const restore = () => {
      attachHiveLayers(map, sensorsRef.current, mapItems());
      applyMode(map, modeRef.current);
    };
    map.once("style.load", restore);
    map.setStyle(STYLES[basemap]);
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource("sensors") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(sensorsGeo(sensors));
  }, [sensors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const items = [...events, ...arcs];
    const src = map.getSource("arcs") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(arcsGeo(items));
    const attackers = map.getSource("attackers") as mapboxgl.GeoJSONSource | undefined;
    attackers?.setData(attackersGeo(items));
  }, [arcs, events]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applyMode(map, mode);
  }, [mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    const lng = focus.src_lon ?? focus.sensor_lon;
    const lat = focus.src_lat ?? focus.sensor_lat;
    map.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), 3.6),
      pitch: mode === "3d" ? 60 : 0,
      essential: true,
      duration: 900,
    });
  }, [focus, mode]);

  if (!TOKEN) {
    return (
      <div data-testid="map-missing-token" className="flex h-full items-center justify-center bg-[#05060a] text-sm text-hive-quiet">
        Add a Mapbox token to show the map
      </div>
    );
  }

  return <div ref={host} data-testid="map-host" className="mapbox-hud h-full min-h-0 w-full flex-1" />;
}
