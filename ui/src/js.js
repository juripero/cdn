// Chart documentation: http://www.chartjs.org/docs/

var ws, ticker, last, brains;

function start() {
  ws = new WebSocket("ws://" + window.location.host + "/ws/admin");
  ws.onopen = function() {
    last = 50; // start at 50ms backoff
    ping();
  }

  ws.onmessage = function(event) {
    var m = JSON.parse(event.data);
    switch (m.typ) {
      case 'stat': brain.addStat(m); break;
      case 'pong': console.debug("Received PONG"); break;
      case 'data': brain.doData(m.msg); break;
      default: console.debug("Received unknown message type", m.typ); break;
    }
  }

  ws.onerror = function(event) { console.debug(event); };

  ws.onclose = function(event) {
    console.debug("closing", event);
    window.clearTimeout(ticker);
    last = Math.min(last * last, 10 * 60 * 1000); // max out at 10m intervals
    window.setTimeout(window.requestAnimationFrame.bind(window, start), Math.floor(Math.random() * last));
  }
}

function ping() {
  ws.send(JSON.stringify({typ: "ping"}));
  ticker = window.setTimeout(window.requestAnimationFrame.bind(window, ping), 30 * 1000);
}

start();

// function createChart(ctx, name) {
//   return new Chart(ctx, {
//     type: 'line',
//     data: {
//       metadata: {}, // Custom data map (stat-name -> dataset index)
//       datasets: [],
//     },
//     options: {
//       title: {
//         display: true,
//         text: name,
//       },
//       scales: {
//         xAxes: [{
//           type: "time",
//           display: false,
//         }],
//         yAxes: [{
//           ticks: {
//             beginAtZero: true,
//           },
//           // scaleLabel: {
//           //   display: true,
//           //   labelString: "count",
//           // },
//         }],
//       },
//       tooltips: {
//         enabled: false,
//       //   callbacks: {
//       //     title: function(items, data) {
//       //       // TODO: convert xlabel to pretty string
//       //       var obj = items[0];
//       //       return data.datasets[obj.datasetIndex].data[obj.index].x;
//       //     },
//       //   }
//       }
//     }
//   })
// }
//
// var colors = ['255,99,132', '54,162,235', '255,206,86', '75,192,192', '153,102,255', '255,159,64'];
// function createDataset(name, colorIDX) {
//   return {
//     label: name,
//     fill: false,
//     borderColor: 'rgba('+colors[colorIDX]+',1)',
//     backgroundColor: 'rgba('+colors[colorIDX]+',0.2)',
//     data: [],
//   };
// }

function Brain() {
  // this.kinds = {}; // map of kind names to columns (stat.who.kind -> div)
  // this.charts = {}; // map of ids to chart types (stat.who.id -> chart)
  this.pre = document.createElement('pre');
  document.body.appendChild(this.pre);
}

// Brain.prototype.addStat = function(stat) {
//   // {"typ":"stat","msg":{"img":{"tot":4,"new":1}},"who":{"id":"C417A89F4D8B2FA392595277A31A41B3","kind":"origin"}}
//   console.log(stat);
//   var now = Date.now();
//
//   // Initalize column if necessary
//   if (!this.kinds.hasOwnProperty(stat.who.kind)) {
//     var col = document.createElement('div');
//     col.classList.add('column');
//     col.id = stat.who.kind; // TODO: remove after debugging
//     document.getElementById("wrapper").appendChild(col);
//     this.kinds[stat.who.kind] = col;
//
//     // Resize all columns as necessary for new addition
//     var size = (100 / Object.keys(this.kinds).length).toString() + "%";
//     for (var kind in this.kinds) kind.width = size;
//   }
//
//   // Initalize chart object if necessary
//   if (!this.charts.hasOwnProperty(stat.who.id)) {
//     var ctx = document.createElement('canvas');
//     ctx.width = 800;
//     ctx.height = 400;
//     this.kinds[stat.who.kind].appendChild(ctx); // TODO: figure out the correct place to put this chart
//     this.charts[stat.who.id] = createChart(ctx, stat.who.kind + " " + stat.who.id.substr(0, 10).toLowerCase());
//   }
//   var active = this.charts[stat.who.id];
//
//   // Iterate the stat object
//   for (var key in stat.msg) {
//
//     // We do not have an index for this statistic (create one)
//     if (!active.data.metadata.hasOwnProperty(key)) {
//       var idx = Object.keys(active.data.metadata).length;
//       active.data.metadata[key] = idx;
//       active.data.datasets.push(createDataset(key, idx)); // idx here is actually color index
//     }
//
//     // TODO: change dataset name to have total included in suffix
//     active.data.datasets[active.data.metadata[key]].data.push({x: now, y: stat.msg[key].new});
//   }
//   active.update();
// };
//
// // For all charts, prune total data points and plot additional 0 points as time progresses
// var ZERO_CAP = 1500, DATA_CAP = 10;
// Brain.prototype.setZeros = function() {
//   console.debug("Brain setting zeros");
//   var now = Date.now();
//
//   // For all charts
//   for (var cid in this.charts) {
//
//     // For all datasets
//     for (var i = 0, chart = this.charts[cid].data; i < chart.datasets.length; i++) {
//       var obj = chart.datasets[i];
//
//       // if the newest item is older than 1.5 seconds
//       if (now - obj.data[obj.data.length - 1].x > ZERO_CAP) {
//         obj.data.push({x: now, y: 0}); // add dummy zero point
//       }
//
//       // if the length of data being shown is more than 10
//       while (obj.data.length > DATA_CAP) obj.data.shift(); // prune one off
//     }
//     this.charts[cid].update(); // TODO: don't update if data hasn't changed
//   }
//
//   // Run this method again at a designated time in the future, ontop of an animation frame
//   window.setTimeout(window.requestAnimationFrame.bind(window, this.setZeros.bind(this)), ZERO_CAP);
// };

Brain.prototype.doData = function(data) {

  // Process data into lists of values for instance agnostic aggregation
  var lists = {};
  for (var key in data) {
    var parts = key.split('.');
    parts.splice(1, 1); // remove host from name
    parts = parts.join('.');
    if (!lists.hasOwnProperty(parts)) lists[parts] = [];
    lists[parts].push(data[key]);
  }

  // Combine data in a pre-defined manner based on type of data
  sum = function(a, b) { return a + b };

  for (var key in lists) {
    var parts = key.split('.'), last = parts[parts.length - 1];
    if (last.indexOf('-') > 0) last = last.split('-')[1];
    switch (last) {

      // summations
      case 'bad':
      case 'img':
      case 'count':
      case 'cacheSize':
      case 'neighbor_hit':
      case 'neighbor_miss':
      case 's2s_calls':
        lists[key] = lists[key].reduce(sum);
        break;

      // averages
      case 'minute':
      case 'percentile':
      case 'rate':
      case 'max':
      case 'min':
      case 'dev':
      case 'mean':
        lists[key] = lists[key].reduce(sum) / lists[key].length;
        break;

      // unknown
      default:
        console.log('unknown suffix', last);
        break
    }
  }

  this.pre.innerHTML = JSON.stringify(lists, 0, 2);
};

// Initalize the brain
brain = new Brain();
// brain.setZeros();
