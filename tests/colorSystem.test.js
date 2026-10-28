// tests/colorSystem.test.js

(function () {
  function log(title, value) {
    console.log(`\n=== ${title} ===`);
    console.log(value);
  }

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  async function runTests() {
    console.log('Starting Color System Tests...\n');

    // ---------------------------------------------------
    // MODULE EXISTENCE
    // ---------------------------------------------------

    assert(window.colorScience, 'colorScience module missing');
    assert(window.harmony, 'harmony module missing');
    assert(window.simulation, 'simulation module missing');
    assert(window.orchestrator, 'orchestrator module missing');

    log('Modules Loaded', {
      colorScience: !!window.colorScience,
      harmony: !!window.harmony,
      simulation: !!window.simulation,
      orchestrator: !!window.orchestrator
    });

    // ---------------------------------------------------
    // INITIALIZE MODULES
    // ---------------------------------------------------

    const catalogData = [
      {
        id: 'paint-red',
        name: 'Warm Red',
        hex: '#ff0000',
        source: 'test'
      },
      {
        id: 'paint-green',
        name: 'Forest Green',
        hex: '#00aa00',
        source: 'test'
      },
      {
        id: 'paint-blue',
        name: 'Ocean Blue',
        hex: '#0000ff',
        source: 'test'
      },
      {
        id: 'paint-white',
        name: 'Soft White',
        hex: '#f5f5f5',
        source: 'test'
      },
      {
        id: 'paint-black',
        name: 'Deep Black',
        hex: '#111111',
        source: 'test'
      }
    ];

    const csInit = await window.colorScience.init({
      catalogData
    });

    assert(csInit.ok, 'colorScience init failed');

    const harmonyInit = window.harmony.init({});
    assert(harmonyInit.ok, 'harmony init failed');

    const simulationInit = window.simulation.init({
      rootElement: document.body
    });

    assert(simulationInit.ok, 'simulation init failed');

    const orchestratorInit = window.orchestrator.init({
      colorScience: window.colorScience,
      harmony: window.harmony,
      simulation: window.simulation
    });

    assert(orchestratorInit.ok, 'orchestrator init failed');

    log('Initialization Complete', {
      colorScience: csInit,
      harmony: harmonyInit,
      simulation: simulationInit,
      orchestrator: orchestratorInit
    });

    // ---------------------------------------------------
    // TEST toLab
    // ---------------------------------------------------

    const lab = window.colorScience.toLab('#ff0000');

    assert(lab.ok, 'toLab failed');
    assert(typeof lab.result.L === 'number', 'Invalid Lab L');
    assert(typeof lab.result.a === 'number', 'Invalid Lab a');
    assert(typeof lab.result.b === 'number', 'Invalid Lab b');

    log('toLab()', lab);

    // ---------------------------------------------------
    // TEST deltaE
    // ---------------------------------------------------

    const delta = window.colorScience.deltaE(
      '#ff0000',
      '#ff1100'
    );

    assert(delta.ok, 'deltaE failed');
    assert(typeof delta.result === 'number', 'deltaE not number');

    log('deltaE()', delta);

    // ---------------------------------------------------
    // TEST findNearest
    // ---------------------------------------------------

    const nearest = window.colorScience.findNearest(
      '#ff0101',
      3
    );

    assert(nearest.ok, 'findNearest failed');
    assert(Array.isArray(nearest.result), 'Nearest result not array');

    log('findNearest()', nearest);

    // ---------------------------------------------------
    // TEST harmony palettes
    // ---------------------------------------------------

    const palettes = window.harmony.generatePalettes(
      '#3366ff',
      {
        count: 4
      }
    );

    assert(palettes.ok, 'generatePalettes failed');

    log('generatePalettes()', palettes);

    // ---------------------------------------------------
    // TEST simulation
    // ---------------------------------------------------

    const simulation = window.simulation.simulate(
      '#3366ff',
      {
        kelvin: 2700,
        intensity: 1
      }
    );

    assert(simulation.ok, 'simulation failed');

    log('simulate()', simulation);

    // ---------------------------------------------------
    // TEST orchestrator.findSimilar
    // ---------------------------------------------------

    const similar = window.orchestrator.findSimilar(
      '#ff0000',
      3
    );

    assert(similar.ok, 'orchestrator.findSimilar failed');

    log('orchestrator.findSimilar()', similar);

    // ---------------------------------------------------
    // TEST orchestrator.simulateLighting
    // ---------------------------------------------------

    const lighting = window.orchestrator.simulateLighting(
      '#00aaff',
      3000,
      {}
    );

    assert(lighting.ok, 'simulateLighting failed');

    log('orchestrator.simulateLighting()', lighting);

    // ---------------------------------------------------
    // TEST orchestrator.recommendAccent
    // ---------------------------------------------------

    const accent = window.orchestrator.recommendAccent(
      '#ffaa00',
      {}
    );

    assert(accent.ok, 'recommendAccent failed');

    log('orchestrator.recommendAccent()', accent);

    // ---------------------------------------------------
    // FINAL RESULT
    // ---------------------------------------------------

    console.log('\n====================================');
    console.log('ALL COLOR SYSTEM TESTS PASSED');
    console.log('====================================\n');
  }

  runTests().catch((err) => {
    console.error('\nTEST FAILURE:\n', err);
  });
})();