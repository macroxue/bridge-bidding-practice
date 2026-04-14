const errors = [];

Module = {
  'onRuntimeInitialized': function() { postMessage(['ready']); },
  'onAbort': function() { postMessage(['abort', errors.join('\n')]); },
  'printErr': function(err) { errors.push('[' + (errors.length + 1) + '] ' + err); },
}

onmessage = function(event) {
  const type = event.data[0];
  const num = event.data[1];
  const hands = event.data[2];
  switch (type) {
    case 'solve':
      const result = Module.solve(hands['West'], hands['North'],
                                  hands['East'], hands['South']);
      postMessage([type, num, result.trim()]);
      break;

    case 'solve_plays':
      const level = event.data[3];
      const trump = event.data[4];
      const lead_seat  = event.data[5];
      const played_cards = event.data[6];
      const plays = Module.solve_plays(hands['West'], hands['North'],
                                       hands['East'], hands['South'],
                                       level, trump, lead_seat,
                                       played_cards);
      postMessage([type, num, plays.trim()]);
      break;
  }
};

// Some browsers don't support WASM SIMD, e.g. Firefox 147.0.2 on Galaxy Tab A.
// Detect SIMD support here and load the right WASM binary in solver.js.
var simd = true;

fetch('solver.wasm?v=0.1')
  .then(response => response.arrayBuffer())
  .then(bytes => {
    simd = WebAssembly.validate(bytes);
    importScripts('solver.js?v=0.1');
  });
