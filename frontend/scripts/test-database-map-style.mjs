import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { useDatabaseMapData } from '../src/lib/database-map-style.ts';

test('Street names use the database while all basemap road geometry is preserved', () => {
  const original = JSON.parse(fs.readFileSync(new URL('../public/damascus-clean-style.json', import.meta.url), 'utf8'));
  const snapshot = JSON.stringify(original);
  const style = useDatabaseMapData(original, '/api');
  assert.equal(style.sources['database-streets'].data, '/api/streets/geojson/');
  const roadLayers = original.layers.filter(layer => layer['source-layer'] === 'transportation');
  assert.ok(roadLayers.length > 0);
  for (const originalLayer of roadLayers) {
    const layer = style.layers.find(layer => layer.id === originalLayer.id);
    assert.deepEqual(layer, originalLayer);
  }
  const labelLayers = original.layers.filter(layer => layer['source-layer'] === 'transportation_name');
  assert.ok(labelLayers.length > 0);
  for (const originalLayer of labelLayers) {
    const layer = style.layers.find(layer => layer.id === originalLayer.id);
    assert.equal(layer.source, 'database-streets');
    assert.equal(layer['source-layer'], undefined);
    assert.deepEqual(layer.paint, originalLayer.paint);
  }
  assert.ok(!style.layers.some(layer => layer['source-layer'] === 'boundary'));
  assert.equal(JSON.stringify(original), snapshot);
});
