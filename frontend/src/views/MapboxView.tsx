import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { severityColor } from "../lib/colors";
import { greatCircle } from "../lib/geo";
import type { HiveEvent, LiveArc, SensorStatus } from "../types";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? "";
const STYLE = "mapbox://styles/mapbox/navigation-night-v1";
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
        color: sensor.online ? "#3DFF8A" : "#FF3B3B",
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

function arcsGeo(arcs: LiveArc[]): ArcCollection {
  return {
    type: "FeatureCollection",
    features: arcs
      .filter((arc) => arc.src_lat != null && arc.src_lon != null)
      .map((arc) => ({
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

function setPaint(map: mapboxgl.Map, id: string, prop: string, value: unknown) {
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    /* some layers use data-driven paint we should not flatten */
  }
}

/** Push the official night style toward HUD navy-black. */
function tintBasemap(map: mapboxgl.Map) {
  map.setFog({
    color: "#050810",
    "high-color": "#071228",
    "horizon-blend": 0.06,
    "space-color": "#02040a",
    "star-intensity": 0.12,
  });

  for (const layer of map.getStyle().layers ?? []) {
    const { id, type } = layer;
    if (type === "background") {
      setPaint(map, id, "background-color", "#050810");
      continue;
    }
    if (type === "fill") {
      if (/water/i.test(id)) {
        setPaint(map, id, "fill-color", "#061018");
        setPaint(map, id, "fill-outline-color", "#0a1a2c");
      } else if (/building/i.test(id)) {
        setPaint(map, id, "fill-color", "#0e1a2c");
      } else {
        setPaint(map, id, "fill-color", "#0a1220");
      }
      continue;
    }
    if (type === "fill-extrusion") {
      setPaint(map, id, "fill-extrusion-color", "#0e1a2c");
      continue;
    }
    if (type === "line") {
      if (/water/i.test(id)) {
        setPaint(map, id, "line-color", "#0a2038");
      } else {
        setPaint(map, id, "line-color", "#16324a");
        setPaint(map, id, "line-opacity", 0.28);
      }
      continue;
    }
    if (type === "symbol") {
      setPaint(map, id, "text-color", "#5a7a94");
      setPaint(map, id, "text-halo-color", "#050810");
      setPaint(map, id, "icon-opacity", 0.45);
    }
  }
}

function applyMode(map: mapboxgl.Map, mode: "2d" | "3d") {
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
              "fill-extrusion-color": "#0e1a2c",
              "fill-extrusion-height": ["get", "height"],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.72,
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
  if (map.getLayer(BUILDINGS)) {
    map.setLayoutProperty(BUILDINGS, "visibility", "none");
  }
  map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
}

export function MapboxView({
  mode,
  sensors,
  arcs,
  focus,
  onSensor,
  onEvent,
}: {
  mode: "2d" | "3d";
  sensors: SensorStatus[];
  arcs: LiveArc[];
  focus: HiveEvent | null;
  onSensor: (sensor: SensorStatus) => void;
  onEvent: (event: HiveEvent) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const sensorsRef = useRef(sensors);
  const arcsRef = useRef(arcs);
  const onSensorRef = useRef(onSensor);
  const onEventRef = useRef(onEvent);
  const modeRef = useRef(mode);
  sensorsRef.current = sensors;
  arcsRef.current = arcs;
  onSensorRef.current = onSensor;
  onEventRef.current = onEvent;
  modeRef.current = mode;

  useEffect(() => {
    if (!TOKEN || !host.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;
    const first = sensorsRef.current[0];
    const map = new mapboxgl.Map({
      container: host.current,
      style: STYLE,
      center: first ? [first.lon, first.lat] : [120.98, 14.6],
      zoom: 2.4,
      pitch: 60,
      bearing: -12,
      attributionControl: false,
      logoPosition: "bottom-left",
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    const onLoad = () => {
      tintBasemap(map);
      map.addSource("sensors", { type: "geojson", data: sensorsGeo(sensorsRef.current) });
      map.addSource("arcs", { type: "geojson", data: arcsGeo(arcsRef.current) });
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
      map.addLayer({
        id: "sensors-point",
        type: "circle",
        source: "sensors",
        paint: {
          "circle-radius": 5,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 1.2,
          "circle-stroke-color": "#38BDF8",
        },
      });
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
      const match = arcsRef.current.find((a) => a.id === id);
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
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource("sensors") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(sensorsGeo(sensors));
  }, [sensors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const src = map.getSource("arcs") as mapboxgl.GeoJSONSource | undefined;
    src?.setData(arcsGeo(arcs));
  }, [arcs]);

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
      <div className="flex h-full items-center justify-center font-mono text-xs text-hive-muted">
        SET VITE_MAPBOX_TOKEN IN frontend/.env
      </div>
    );
  }

  return <div ref={host} className="mapbox-hud h-full min-h-0 w-full flex-1" />;
}
