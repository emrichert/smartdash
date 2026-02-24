mapboxgl.accessToken = 'pk.eyJ1IjoibXJpY2hlcnQiLCJhIjoiY21tMGhreHJ4MDB5MTJycHdvMXVybW53eCJ9.d7Y9txTkKEUMLCEmdYvpaw';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v10',
  zoom: 3.4,
  center: [-80, 38]
});

// Legend
const legendBreaks = [
  '4.492 - 40.036',
  '40.037 - 62.551',
  '62.552 - 86.020',
  '86.021 - 124.393',
  '124.394 - 291.297'
];

const legendColors = ['#FED7D6', '#FDB0A1', '#FA896F', '#F25E3C', '#E51C13'];

const legend = document.getElementById('legend');
legend.innerHTML = "<b>Covid-19 Rates<br>(cases/1k people)</b><br><br>";

legendBreaks.forEach((label, i) => {
  const item = document.createElement('div');

  const key = document.createElement('span');
  key.className = 'legend-key';
  key.style.backgroundColor = legendColors[i];

  const value = document.createElement('span');
  value.innerHTML = label;

  item.appendChild(key);
  item.appendChild(value);
  legend.appendChild(item);
});

const reset = document.getElementById('reset');

reset.addEventListener('click', (e) => {
  e.preventDefault(); 

  map.flyTo({
    zoom: 3.4,
    center: [-80, 38]
  });

  map.setFilter('countyData-selected-outline', ['==', ['get', 'fips'], '']);

  kpiRateChart.load({ columns: [['Rate', 0]] });

  const circles = document.querySelectorAll('#scatter-rate-pop18 svg circle.c3-circle');
  circles.forEach(c => {
    c.classList.remove('selected-dot');
    c.setAttribute('r', '4');
  });

  if (scatterChart.unzoom) {
    scatterChart.unzoom();
  }
});

// KPI Gauge
const kpiRateChart = c3.generate({
  bindto: '#kpi-rate',
  data: {
    columns: [['Rate', 0]],
    type: 'gauge'
  },
  tooltip: { 
    show: false 
    },
  gauge: {
    label: { 
        format: (v) => v.toFixed(1) 
    },
    min: 0,
    max: 291.3,
    units: ' per 1,000 adults',
    width: 18
  },
  color: {
    pattern: ['#FED7D6', '#FDB0A1', '#FA896F', '#F25E3C', '#E51C13'],
    threshold: { 
        values: [40.036, 62.551, 86.02, 124.393] 
    }
  },
  size: { 
    height: 180 
    }
});

function updateKpiRateFromFeature(feature) {
  kpiRateChart.load({ columns: [['Rate', Number(feature.properties.rates)]] });
}


let pop18Arr = [];
let rateArr = [];
let scatterMeta = [];
let metaByXY = new Map();

function toNum(v) {
  if (v == null) return NaN;
  return Number(String(v).replace(/,/g, ''));
}

function xyKey(x, y) {
  return `${Math.round(x)}|${Number(y).toFixed(3)}`;
}

// Scatterplot
const scatterChart = c3.generate({
  bindto: '#scatter-rate-pop18',
  data: {
    xs: { 
        Rate: 'Pop18' 
    },
    columns: [['Pop18'], ['Rate']],
    type: 'scatter'
  },
  axis: {
    x: {
      label: 'Population (18+)',
      tick: { 
        format: d3.format(','), count: 6 
        }
    },
    y: {
      label: 'COVID Rate (cases per 1,000)',
      min: 0,
      padding: { 
        top: 0, bottom: 0 
        },
      tick: { 
        count: 6, format: d3.format('.1f') 
        }
    }
  },
  point: { 
    r: 4 
    },
  tooltip: {
    contents: function (d) {
      const xVal = d && d[0] ? d[0].x : null;
      const yVal = d && d[0] ? d[0].value : null;

      const k = (xVal != null && yVal != null) ? xyKey(xVal, yVal) : null;
      const meta = (k && metaByXY.has(k)) ? metaByXY.get(k) : null;

      const header = meta ? `${meta.county}, ${meta.state}` : 'Unknown county';
      const pop = meta ? meta.pop18 : xVal;
      const rate = meta ? meta.rate : yVal;

      return `
        <div style="
          background: rgba(255,255,255,0.97);
          border: 1px solid rgba(0,0,0,0.25);
          border-radius: 10px;
          box-shadow: 0 8px 22px rgba(0,0,0,0.25);
          padding: 10px 12px;
          color: #111;
          opacity: 1;
          font-family: 'Titillium Web', serif;
        ">
          <div style="font-weight: 700; margin-bottom: 6px;">${header}</div>
          <div style="font-size: 12px; line-height: 1.35;">
            <div><span style="opacity:0.75;">Pop (18+):</span> ${pop != null ? d3.format(',')(pop) : '—'}</div>
            <div><span style="opacity:0.75;">Rate:</span> ${rate != null ? (+rate).toFixed(3) : '—'}</div>
          </div>
        </div>
      `;
    }
  },
  size: { 
    height: 260 
    },
  legend: { 
    show: false 
    },
  zoom: { 
    enabled: true 
    }
});

function loadScatterFromGeojson(geojson) {
  const feats = geojson.features;

  scatterMeta = feats
    .map(f => ({
      county: f.properties.county,
      state: f.properties.state,
      pop18: toNum(f.properties.pop18),
      rate: toNum(f.properties.rates)
    }))
    .filter(d => Number.isFinite(d.pop18) && Number.isFinite(d.rate));

  metaByXY = new Map();
  for (const m of scatterMeta) {
    const k = xyKey(m.pop18, m.rate);
    if (!metaByXY.has(k)) metaByXY.set(k, m);
  }

  pop18Arr = scatterMeta.map(d => d.pop18);
  rateArr = scatterMeta.map(d => d.rate);

  scatterChart.load({
    columns: [
      ['Pop18', ...pop18Arr],
      ['Rate', ...rateArr]
    ]
  });
}

// Highlight by the clicked feature's x and y using bound __data__ on circles
function highlightScatterByFeature(feature) {
  const pop = toNum(feature.properties.pop18);
  const rate = toNum(feature.properties.rates);
  if (!Number.isFinite(pop) || !Number.isFinite(rate)) return;

  const key = xyKey(pop, rate);

  const circles = document.querySelectorAll('#scatter-rate-pop18 svg circle.c3-circle');
  circles.forEach(c => {
    c.classList.remove('selected-dot');
    c.setAttribute('r', '4');
  });

  let selected = null;
  circles.forEach(c => {
    const d = c.__data__;
    if (!d) return;
    if (xyKey(d.x, d.value) === key) selected = c;
  });

  if (!selected) return;

  selected.classList.add('selected-dot');
  selected.setAttribute('r', '9');

  const parent = selected.parentNode;
  if (parent) parent.appendChild(selected);
}

// Data n Map layers
async function geojsonFetch() {
  const response = await fetch('./assets/us-covid.json');
  const countyData = await response.json();

  map.on('load', () => {
    map.addSource('countyData', {
      type: 'geojson',
      data: countyData
    });

    map.addLayer({
      id: 'countyData-layer',
      type: 'fill',
      source: 'countyData',
      paint: {
        'fill-color': [
          'step',
          ['get', 'rates'],
          '#FED7D6',
          40.036, '#FDB0A1',
          62.551, '#FA896F',
          86.02, '#F25E3C',
          124.393, '#E51C13'
        ],
        'fill-outline-color': '#858181',
        'fill-opacity': 0.7
      }
    });

    map.addLayer({
      id: 'countyData-selected-outline',
      type: 'line',
      source: 'countyData',
      paint: {
        'line-color': '#00d5ff',
        'line-width': 2
      },
      filter: ['==', ['get', 'fips'], '']
    });

    loadScatterFromGeojson(countyData);

    setTimeout(() => {
      scatterChart.flush();
      scatterChart.resize({ height: 290 });
    }, 0);

    if (countyData.features && countyData.features.length) {
      updateKpiRateFromFeature(countyData.features[0]);
    }

    map.on('mousemove', 'countyData-layer', (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;

      document.getElementById('text-description').innerHTML = `
        <h3>${feature.properties.county}, ${feature.properties.state}</h3>
        <p><strong><em>${(+feature.properties.rates).toFixed(3)}</em></strong> cases per 1,000 people</p>
      `;
    });

    map.on('mouseleave', 'countyData-layer', () => {
      document.getElementById('text-description').innerHTML =
        `<p>Hover over a county to see its COVID-19 rate.</p>`;
    });

    map.on('click', 'countyData-layer', (e) => {
      const feature = e.features && e.features[0];
      if (!feature) return;

      updateKpiRateFromFeature(feature);

      map.setFilter('countyData-selected-outline', ['==', ['get', 'fips'], feature.properties.fips]);

      highlightScatterByFeature(feature);
    });
  });
}

geojsonFetch();