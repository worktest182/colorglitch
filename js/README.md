# Modular Color System

## Usage Examples

### 1) Initialize modules

```js
import colorScience from './js/modules/colorScience.js';
import harmony from './js/modules/harmony.js';
import simulation from './js/modules/simulation.js';
import orchestrator from './js/modules/orchestrator.js';

await colorScience.init({ catalogPath: './data/final_catalog.json', cacheLab: true });
harmony.init({});
simulation.init({ rootElement: document.getElementById('preview') });
orchestrator.init({ colorScience, harmony, simulation });
```

### 2) Accent recommendation flow

```js
const accent = orchestrator.recommendAccent('#5A8F3D');
// { ok, result: { idealAccentHex, matchedHex, simulatedHex } }
```

### 3) Similar colors flow

```js
const similar = orchestrator.findSimilar('#5A8F3D', 5);
// { ok, result: [{ id, name, hex, source, deltaE }] }
```

### 4) Lighting simulation flow

```js
const simulated = orchestrator.simulateLighting('#5A8F3D', 3000, { intensity: 0.9 });
// { ok, result: { simulatedHex } }
```