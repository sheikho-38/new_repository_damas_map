import type { StyleSpecification } from 'maplibre-gl';

// Keep the complete basemap road network; use database geometry only to position labels.
export function useDatabaseMapData(style: StyleSpecification, apiBaseUrl: string): StyleSpecification {
  return {
    ...style,
    sources: {
      ...style.sources,
      'database-streets': { type: 'geojson', data: `${apiBaseUrl}/streets/geojson/` },
    },
    layers: style.layers
      .filter(layer => !('source-layer' in layer && layer['source-layer'] === 'boundary'))
      .map(layer => {
        if (!('source-layer' in layer) || layer['source-layer'] !== 'transportation_name') {
          return layer;
        }
        const databaseLayer = { ...layer, source: 'database-streets' };
        delete databaseLayer['source-layer'];
        return databaseLayer;
      }),
  };
}
