export const TEST_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GridWise LLM — Interactive Test Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
  </style>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen">
  <!-- Top Navigation Header -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg shadow-emerald-500/20">
          <i class="fa-solid fa-bolt"></i>
        </div>
        <div>
          <h1 class="font-bold text-lg text-white leading-none">GridWise LLM</h1>
          <p class="text-xs text-slate-400">Smart Campus Energy Optimization Tester</p>
        </div>
      </div>
      <div class="flex items-center space-x-4">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span class="h-2 w-2 rounded-full bg-emerald-400 mr-2 animate-pulse"></span> Service Active
        </span>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
    
    <!-- Left Column: Input Form & Sample Case Selector -->
    <section class="lg:col-span-5 space-y-6">
      
      <!-- Preset Case Picker -->
      <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
        <label class="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
          <i class="fa-solid fa-folder-open mr-1.5"></i> Load Official Public Sample Case
        </label>
        <select id="sampleSelect" onchange="loadSampleCase()" class="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition">
          <option value="">-- Select a Public Sample Case --</option>
          <option value="SAMPLE-01">SAMPLE-01: Solar Cleaning + Distractor</option>
          <option value="SAMPLE-02">SAMPLE-02: Battery Charging Maintenance</option>
          <option value="SAMPLE-03">SAMPLE-03: Emergency Reserve as Percentage</option>
          <option value="SAMPLE-04">SAMPLE-04: No-Discharge Protection Test</option>
          <option value="SAMPLE-05">SAMPLE-05: Temporary Feeder Grid Cap</option>
          <option value="SAMPLE-06">SAMPLE-06: Multiple Notes with Distractor</option>
          <option value="SAMPLE-07">SAMPLE-07: Reserve plus Transformer Cap</option>
          <option value="SAMPLE-08">SAMPLE-08: Separate Charge/Discharge Outages</option>
          <option value="SAMPLE-09">SAMPLE-09: Reduction Wording Normalization</option>
          <option value="SAMPLE-10">SAMPLE-10: Multi-Constraint Evening Operation</option>
        </select>
      </div>

      <!-- Request Details Card -->
      <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 shadow-xl space-y-5">
        
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Scenario ID</label>
          <input type="text" id="scenarioId" value="TEST-SCENARIO-01" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
        </div>

        <!-- Operator Notes -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <i class="fa-solid fa-user-gear mr-1 text-emerald-400"></i> Operator Natural Language Notes (1 to 3)
          </label>
          <div class="space-y-2">
            <textarea id="note1" rows="2" placeholder="Note 1 e.g. Wash rooftop solar panels from noon until 2 PM..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"></textarea>
            <textarea id="note2" rows="2" placeholder="Note 2 (optional)..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"></textarea>
            <textarea id="note3" rows="2" placeholder="Note 3 (optional)..." class="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"></textarea>
          </div>
        </div>

        <!-- Battery Spec Inputs -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <i class="fa-solid fa-car-battery mr-1 text-cyan-400"></i> Battery Specifications
          </label>
          <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span class="text-slate-400">Capacity (kWh)</span>
              <input type="number" id="batCapacity" value="220" class="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <span class="text-slate-400">Initial Energy (kWh)</span>
              <input type="number" id="batInitial" value="110" class="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <span class="text-slate-400">Min Reserve (kWh)</span>
              <input type="number" id="batMin" value="40" class="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <span class="text-slate-400">Max Charge Rate (kWh/h)</span>
              <input type="number" id="batMaxCharge" value="50" class="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
            <div class="col-span-2">
              <span class="text-slate-400">Max Discharge Rate (kWh/h)</span>
              <input type="number" id="batMaxDischarge" value="50" class="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
            </div>
          </div>
        </div>

        <!-- Execute Button -->
        <button onclick="runOptimization()" id="runBtn" class="w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition transform active:scale-95 flex items-center justify-center space-x-2">
          <i class="fa-solid fa-play"></i>
          <span>Run Optimization Pipeline</span>
        </button>

      </div>
    </section>

    <!-- Right Column: Outputs & Visual Plan -->
    <section class="lg:col-span-7 space-y-6">
      
      <!-- Metrics Overview Cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 text-center">
          <span class="text-xs text-slate-400 font-medium">Total Grid Import</span>
          <div id="metricGrid" class="text-2xl font-bold text-emerald-400 mt-1">-- kWh</div>
        </div>
        <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 text-center">
          <span class="text-xs text-slate-400 font-medium">Total Cost</span>
          <div id="metricCost" class="text-2xl font-bold text-cyan-400 mt-1">-- BDT</div>
        </div>
        <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 text-center">
          <span class="text-xs text-slate-400 font-medium">Peak Demand</span>
          <div id="metricPeak" class="text-2xl font-bold text-amber-400 mt-1">-- kWh</div>
        </div>
      </div>

      <!-- Plan Summary Card -->
      <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          <i class="fa-solid fa-quote-left mr-1.5 text-emerald-400"></i> Plan Summary & Explanation
        </h3>
        <p id="planSummaryText" class="text-sm text-slate-300 italic">Run optimization to see summary.</p>
      </div>

      <!-- Directive Interpretations Card -->
      <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 shadow-xl">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          <i class="fa-solid fa-brain mr-1.5 text-purple-400"></i> Interpreted Directives (LLM + Guardrails)
        </h3>
        <div id="directivesContainer" class="space-y-2 text-xs text-slate-400">
          No directives interpreted yet.
        </div>
      </div>

      <!-- 24-Hour Schedule Table -->
      <div class="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-5 shadow-xl overflow-hidden">
        <h3 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          <i class="fa-solid fa-chart-line mr-1.5 text-emerald-400"></i> 24-Hour Optimized Schedule
        </h3>
        <div class="overflow-x-auto max-h-96">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-950 text-slate-400 uppercase sticky top-0">
              <tr>
                <th class="py-2.5 px-3">Hour</th>
                <th class="py-2.5 px-3">Grid (kWh)</th>
                <th class="py-2.5 px-3">Solar Used</th>
                <th class="py-2.5 px-3">Battery Action</th>
                <th class="py-2.5 px-3">Battery kWh</th>
                <th class="py-2.5 px-3">SOC After</th>
              </tr>
            </thead>
            <tbody id="planTableBody" class="divide-y divide-slate-800/60 text-slate-200">
              <tr>
                <td colspan="6" class="py-4 text-center text-slate-500">No schedule generated yet. Click "Run Optimization".</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </section>
  </main>

  <script>
    let samplePackData = null;

    // Default sample case 1 data fallback
    const DEFAULT_HOURS = [
      { "hour": 0, "demand_kwh": 90, "solar_kwh": 0, "tariff_bdt_per_kwh": 6 },
      { "hour": 1, "demand_kwh": 85, "solar_kwh": 0, "tariff_bdt_per_kwh": 6 },
      { "hour": 2, "demand_kwh": 80, "solar_kwh": 0, "tariff_bdt_per_kwh": 5 },
      { "hour": 3, "demand_kwh": 80, "solar_kwh": 0, "tariff_bdt_per_kwh": 5 },
      { "hour": 4, "demand_kwh": 85, "solar_kwh": 0, "tariff_bdt_per_kwh": 5 },
      { "hour": 5, "demand_kwh": 95, "solar_kwh": 0, "tariff_bdt_per_kwh": 6 },
      { "hour": 6, "demand_kwh": 110, "solar_kwh": 5, "tariff_bdt_per_kwh": 8 },
      { "hour": 7, "demand_kwh": 130, "solar_kwh": 20, "tariff_bdt_per_kwh": 10 },
      { "hour": 8, "demand_kwh": 150, "solar_kwh": 50, "tariff_bdt_per_kwh": 12 },
      { "hour": 9, "demand_kwh": 165, "solar_kwh": 90, "tariff_bdt_per_kwh": 14 },
      { "hour": 10, "demand_kwh": 175, "solar_kwh": 130, "tariff_bdt_per_kwh": 16 },
      { "hour": 11, "demand_kwh": 180, "solar_kwh": 160, "tariff_bdt_per_kwh": 16 },
      { "hour": 12, "demand_kwh": 185, "solar_kwh": 180, "tariff_bdt_per_kwh": 15 },
      { "hour": 13, "demand_kwh": 180, "solar_kwh": 170, "tariff_bdt_per_kwh": 14 },
      { "hour": 14, "demand_kwh": 170, "solar_kwh": 140, "tariff_bdt_per_kwh": 13 },
      { "hour": 15, "demand_kwh": 165, "solar_kwh": 90, "tariff_bdt_per_kwh": 14 },
      { "hour": 16, "demand_kwh": 170, "solar_kwh": 45, "tariff_bdt_per_kwh": 18 },
      { "hour": 17, "demand_kwh": 185, "solar_kwh": 10, "tariff_bdt_per_kwh": 22 },
      { "hour": 18, "demand_kwh": 205, "solar_kwh": 0, "tariff_bdt_per_kwh": 28 },
      { "hour": 19, "demand_kwh": 215, "solar_kwh": 0, "tariff_bdt_per_kwh": 30 },
      { "hour": 20, "demand_kwh": 205, "solar_kwh": 0, "tariff_bdt_per_kwh": 26 },
      { "hour": 21, "demand_kwh": 175, "solar_kwh": 0, "tariff_bdt_per_kwh": 18 },
      { "hour": 22, "demand_kwh": 135, "solar_kwh": 0, "tariff_bdt_per_kwh": 10 },
      { "hour": 23, "demand_kwh": 105, "solar_kwh": 0, "tariff_bdt_per_kwh": 7 }
    ];

    let currentHoursData = DEFAULT_HOURS;

    async function loadSampleCase() {
      const select = document.getElementById('sampleSelect');
      const caseId = select.value;
      if (!caseId) return;

      try {
        if (!samplePackData) {
          // Fetch sample pack
          const res = await fetch('/sample-pack.json');
          if (res.ok) {
            samplePackData = await res.json();
          }
        }

        if (samplePackData && samplePackData.cases) {
          const found = samplePackData.cases.find(c => c.id === caseId);
          if (found) {
            document.getElementById('scenarioId').value = found.input.scenario_id;
            document.getElementById('note1').value = found.input.operator_notes[0] || '';
            document.getElementById('note2').value = found.input.operator_notes[1] || '';
            document.getElementById('note3').value = found.input.operator_notes[2] || '';

            document.getElementById('batCapacity').value = found.input.battery.capacity_kwh;
            document.getElementById('batInitial').value = found.input.battery.initial_energy_kwh;
            document.getElementById('batMin').value = found.input.battery.minimum_energy_kwh;
            document.getElementById('batMaxCharge').value = found.input.battery.max_charge_kwh_per_hour;
            document.getElementById('batMaxDischarge').value = found.input.battery.max_discharge_kwh_per_hour;

            currentHoursData = found.input.hours;
          }
        }
      } catch (e) {
        console.error('Failed to load sample case:', e);
      }
    }

    async function runOptimization() {
      const runBtn = document.getElementById('runBtn');
      runBtn.disabled = true;
      runBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i> <span>Optimizing...</span>';

      const notes = [
        document.getElementById('note1').value.trim(),
        document.getElementById('note2').value.trim(),
        document.getElementById('note3').value.trim()
      ].filter(n => n.length > 0);

      const requestBody = {
        scenario_id: document.getElementById('scenarioId').value || 'CUSTOM-01',
        operator_notes: notes.length > 0 ? notes : ['No operational constraints given.'],
        hours: currentHoursData,
        battery: {
          capacity_kwh: parseFloat(document.getElementById('batCapacity').value),
          initial_energy_kwh: parseFloat(document.getElementById('batInitial').value),
          minimum_energy_kwh: parseFloat(document.getElementById('batMin').value),
          max_charge_kwh_per_hour: parseFloat(document.getElementById('batMaxCharge').value),
          max_discharge_kwh_per_hour: parseFloat(document.getElementById('batMaxDischarge').value)
        }
      };

      try {
        const res = await fetch('/optimize-energy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await res.json();
        if (!res.ok) {
          alert('Optimization Error: ' + (data.message || JSON.stringify(data)));
          return;
        }

        renderResults(data);
      } catch (err) {
        alert('Request failed: ' + err.message);
      } finally {
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Run Optimization Pipeline</span>';
      }
    }

    function renderResults(data) {
      document.getElementById('metricGrid').innerText = data.total_grid_kwh + ' kWh';
      document.getElementById('metricCost').innerText = data.total_cost_bdt + ' BDT';
      document.getElementById('metricPeak').innerText = data.peak_grid_kwh + ' kWh';
      document.getElementById('planSummaryText').innerText = data.plan_summary;

      // Render Directives
      const dirContainer = document.getElementById('directivesContainer');
      dirContainer.innerHTML = '';
      (data.directive_interpretation || []).forEach(d => {
        const div = document.createElement('div');
        div.className = 'p-3 rounded-xl border bg-slate-900/80 flex items-start justify-between ' + (d.applies ? 'border-emerald-500/30 text-emerald-300' : 'border-slate-700 text-slate-400');
        div.innerHTML = \`
          <div>
            <span class="font-semibold text-xs px-2 py-0.5 rounded \${d.applies ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}">
              Note \${d.note_index}: \${d.directive_type}
            </span>
            <p class="mt-1.5 text-xs text-slate-200">\${d.explanation}</p>
          </div>
          \${d.structured_adjustment ? \`<pre class="text-[10px] bg-slate-950 p-2 rounded text-cyan-300 font-mono">\${JSON.stringify(d.structured_adjustment)}</pre>\` : ''}
        \`;
        dirContainer.appendChild(div);
      });

      // Render 24-hour table
      const tbody = document.getElementById('planTableBody');
      tbody.innerHTML = '';
      (data.hourly_plan || []).forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-800/40 transition';

        let badgeClass = 'bg-slate-800 text-slate-400';
        if (row.battery_action === 'charge') badgeClass = 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30';
        if (row.battery_action === 'discharge') badgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';

        tr.innerHTML = \`
          <td class="py-2.5 px-3 font-mono font-medium text-slate-400">Hour \${row.hour}</td>
          <td class="py-2.5 px-3 font-semibold text-emerald-400">\${row.grid_kwh}</td>
          <td class="py-2.5 px-3 text-yellow-400">\${row.solar_used_kwh}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[11px] uppercase font-semibold \${badgeClass}">\${row.battery_action}</span>
          </td>
          <td class="py-2.5 px-3 font-mono text-slate-300">\${row.battery_kwh}</td>
          <td class="py-2.5 px-3 font-mono font-bold text-cyan-300">\${row.battery_energy_after_kwh}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    // Auto load default case 1 on start
    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('sampleSelect').value = 'SAMPLE-01';
      loadSampleCase();
    });
  </script>
</body>
</html>`;
