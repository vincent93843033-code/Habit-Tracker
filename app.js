(function () {
  "use strict";

  var STORAGE_KEY = "habitTrackerData_v1";

  var DEFAULT_DATA = {
    habits: {
      good: [
        { id: "exercise", name: "運動" },
        { id: "reading", name: "閱讀" },
        { id: "water", name: "喝水量" }
      ],
      bad: [
        { id: "lateNight", name: "熬夜" },
        { id: "phone", name: "滑手機過久" },
        { id: "snack", name: "吃宵夜" }
      ]
    },
    records: {},
    settings: { sheetUrl: "" }
  };

  var RED = [240, 153, 123];
  var CREAM = [250, 238, 218];
  var GREEN = [151, 196, 89];

  var data;
  var statsChart = null;
  var statsMode = "trend";

  /* ---------- storage ---------- */

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(DEFAULT_DATA);
      var parsed = JSON.parse(raw);
      return {
        habits: parsed.habits || clone(DEFAULT_DATA.habits),
        records: parsed.records || {},
        settings: Object.assign({ sheetUrl: "" }, parsed.settings || {})
      };
    } catch (e) {
      return clone(DEFAULT_DATA);
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /* ---------- date helpers ---------- */

  function dateKey(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function normalizeDateValue(v) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    var d = new Date(v);
    if (!isNaN(d.getTime())) return dateKey(d);
    return String(v);
  }

  /* ---------- score & color ---------- */

  function computeScore(record) {
    var good = data.habits.good;
    var goodAvg = 50;
    if (good.length > 0) {
      var total = 0;
      good.forEach(function (h) {
        var v = record[h.id];
        if (v === undefined || v === null) v = 5;
        total += Math.max(0, Math.min(10, Number(v)));
      });
      goodAvg = (total / good.length / 10) * 100;
    }
    var penalty = 0;
    data.habits.bad.forEach(function (h) {
      if (record[h.id]) penalty += 15;
    });
    return Math.max(0, Math.min(100, Math.round(goodAvg - penalty)));
  }

  function mix(c1, c2, t) {
    return [
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    ];
  }

  function rgbStr(c) {
    return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
  }

  function scoreColor(score) {
    var t = score / 100;
    return t < 0.5 ? rgbStr(mix(RED, CREAM, t / 0.5)) : rgbStr(mix(CREAM, GREEN, (t - 0.5) / 0.5));
  }

  function scoreTextColor(score) {
    if (score < 35) return "#791F1F";
    if (score > 70) return "#27500A";
    return "#854F0B";
  }

  function moodMessage(score) {
    if (score >= 75) return "狀態很棒,繼續保持";
    if (score >= 50) return "穩定中,再加油一點";
    if (score >= 25) return "有點辛苦,放鬆一下吧";
    return "今天比較低落,明天再努力";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- records ---------- */

  function getTodayRecord() {
    var key = todayKey();
    var rec = data.records[key];
    if (!rec) {
      rec = { date: key };
      data.records[key] = rec;
    }
    data.habits.good.forEach(function (h) {
      if (rec[h.id] === undefined) rec[h.id] = 5;
    });
    data.habits.bad.forEach(function (h) {
      if (rec[h.id] === undefined) rec[h.id] = false;
    });
    return rec;
  }

  function persistTodayRecord(rec) {
    rec.score = computeScore(rec);
    saveData();
  }

  /* ---------- status messages ---------- */

  function setStatus(id, msg, isError) {
    var el = document.getElementById(id);
    el.textContent = msg;
    el.className = "save-status " + (isError ? "error" : "success");
    setTimeout(function () {
      el.textContent = "";
      el.className = "save-status";
    }, 4000);
  }

  /* ---------- today view ---------- */

  function renderToday() {
    renderGoodHabits();
    renderBadHabits();
    updateMood();
  }

  function renderGoodHabits() {
    var record = getTodayRecord();
    var list = document.getElementById("goodHabitsList");
    var empty = document.getElementById("goodEmptyHint");
    list.innerHTML = "";
    empty.style.display = data.habits.good.length === 0 ? "block" : "none";

    data.habits.good.forEach(function (h) {
      var val = record[h.id];
      var item = document.createElement("div");
      item.className = "habit-item";
      item.innerHTML =
        '<div class="habit-row"><span>' + escapeHtml(h.name) + '</span>' +
        '<span class="habit-value" id="val-' + h.id + '">' + val + "</span></div>" +
        '<input type="range" min="0" max="10" step="1" value="' + val + '" data-id="' + h.id + '">';
      list.appendChild(item);
    });

    list.querySelectorAll("input[type=range]").forEach(function (slider) {
      updateSliderFill(slider);
      slider.addEventListener("input", function () {
        var id = slider.dataset.id;
        var v = Number(slider.value);
        document.getElementById("val-" + id).textContent = v;
        updateSliderFill(slider);
        var r = getTodayRecord();
        r[id] = v;
        persistTodayRecord(r);
        updateMood();
      });
    });
  }

  function updateSliderFill(slider) {
    var min = Number(slider.min) || 0;
    var max = Number(slider.max) || 100;
    var pct = ((Number(slider.value) - min) / (max - min)) * 100;
    slider.style.setProperty("--fill", pct + "%");
  }

  function renderBadHabits() {
    var record = getTodayRecord();
    var list = document.getElementById("badHabitsList");
    var empty = document.getElementById("badEmptyHint");
    list.innerHTML = "";
    empty.style.display = data.habits.bad.length === 0 ? "block" : "none";

    data.habits.bad.forEach(function (h) {
      var checked = !!record[h.id];
      var label = document.createElement("label");
      label.className = "checkbox-row";
      label.innerHTML =
        '<input type="checkbox" data-id="' + h.id + '"' + (checked ? " checked" : "") + ">" +
        "<span>" + escapeHtml(h.name) + "</span>";
      list.appendChild(label);
    });

    list.querySelectorAll("input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        var r = getTodayRecord();
        r[cb.dataset.id] = cb.checked;
        persistTodayRecord(r);
        updateMood();
      });
    });
  }

  function updateMood() {
    var record = getTodayRecord();
    var score = computeScore(record);
    record.score = score;
    saveData();

    var color = scoreColor(score);
    var textColor = scoreTextColor(score);

    document.getElementById("moodBanner").style.background = color;
    var scoreEl = document.getElementById("scoreNum");
    scoreEl.textContent = score;
    scoreEl.style.color = textColor;
    var msgEl = document.getElementById("moodMsg");
    msgEl.textContent = moodMessage(score);
    msgEl.style.color = textColor;

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", color);
  }

  /* ---------- stats view ---------- */

  function getLastNDays(n) {
    var days = [];
    var today = new Date();
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(today);
      d.setDate(d.getDate() - i);
      var key = dateKey(d);
      var rec = data.records[key];
      days.push({
        key: key,
        label: (d.getMonth() + 1) + "/" + d.getDate(),
        score: rec && rec.score !== undefined ? rec.score : null
      });
    }
    return days;
  }

  function renderStats() {
    var days14 = getLastNDays(14);
    var todayRec = getTodayRecord();
    days14[days14.length - 1].score = computeScore(todayRec);

    document.getElementById("statTodayScore").textContent = days14[days14.length - 1].score;

    var last7 = days14.slice(-7).filter(function (d) { return d.score !== null; });
    var avg = last7.length
      ? Math.round(last7.reduce(function (s, d) { return s + d.score; }, 0) / last7.length)
      : "--";
    document.getElementById("statAvgScore").textContent = avg;

    renderChart(days14);
    renderHeatmap();
  }

  function renderChart(days14) {
    var ctx = document.getElementById("statsChart");
    if (statsChart) statsChart.destroy();

    if (statsMode === "trend") {
      statsChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: days14.map(function (d) { return d.label; }),
          datasets: [{
            label: "每日分數",
            data: days14.map(function (d) { return d.score; }),
            borderColor: "#D85A30",
            backgroundColor: "rgba(216,90,48,0.1)",
            fill: true,
            tension: 0.35,
            spanGaps: true,
            pointRadius: 3,
            pointBackgroundColor: "#D85A30"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0, max: 100, ticks: { stepSize: 25, color: "#A07C5B", font: { size: 11 } }, grid: { color: "#F1EFE8" } },
            x: { ticks: { color: "#A07C5B", font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 }, grid: { display: false } }
          },
          plugins: { legend: { display: false } }
        }
      });
      document.getElementById("chartLegend").innerHTML =
        '<span class="dot"><span class="sw" style="background:#D85A30;"></span>每日分數 (0-100)</span>';
    } else {
      var withData = days14.filter(function (d) { return d.score !== null; });
      var good = withData.filter(function (d) { return d.score >= 50; }).length;
      var bad = withData.length - good;
      var total = (good + bad) || 1;

      statsChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["表現良好", "需要加油"],
          datasets: [{ data: [good, bad], backgroundColor: ["#97C459", "#F0997B"], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: "65%" }
      });
      document.getElementById("chartLegend").innerHTML =
        '<span class="dot"><span class="sw" style="background:#97C459;"></span>表現良好 ' + good + "天 (" + Math.round((good / total) * 100) + "%)</span>" +
        '<span class="dot"><span class="sw" style="background:#F0997B;"></span>需要加油 ' + bad + "天 (" + Math.round((bad / total) * 100) + "%)</span>";
    }
  }

  function renderHeatmap() {
    var grid = document.getElementById("heatmapGrid");
    grid.innerHTML = "";
    var days = getLastNDays(91);
    var todayScore = computeScore(getTodayRecord());
    days[days.length - 1].score = todayScore;

    days.forEach(function (d) {
      var cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.title = d.key + (d.score !== null ? " · " + d.score + "分" : " · 無紀錄");
      if (d.score !== null) cell.style.background = scoreColor(d.score);
      grid.appendChild(cell);
    });

    var scroller = grid.parentElement;
    scroller.scrollLeft = scroller.scrollWidth;
  }

  /* ---------- settings view ---------- */

  function renderSettings() {
    renderHabitEditList("good");
    renderHabitEditList("bad");
    document.getElementById("sheetUrlInput").value = data.settings.sheetUrl || "";
  }

  function renderHabitEditList(type) {
    var container = document.getElementById(type === "good" ? "goodHabitsEdit" : "badHabitsEdit");
    container.innerHTML = "";

    data.habits[type].forEach(function (h) {
      var row = document.createElement("div");
      row.className = "habit-edit-row";
      row.innerHTML =
        '<input type="text" value="' + escapeHtml(h.name) + '" data-id="' + h.id + '">' +
        '<button class="icon-btn-sm danger" data-id="' + h.id + '" aria-label="刪除">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' +
        "</button>";
      container.appendChild(row);
    });

    container.querySelectorAll("input[type=text]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var habit = data.habits[type].find(function (h) { return h.id === inp.dataset.id; });
        if (habit) {
          habit.name = inp.value.trim() || habit.name;
          inp.value = habit.name;
          saveData();
          renderToday();
        }
      });
    });

    container.querySelectorAll(".icon-btn-sm.danger").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!confirm("確定要刪除這個習慣嗎？歷史紀錄會保留,但今天起不再顯示。")) return;
        data.habits[type] = data.habits[type].filter(function (h) { return h.id !== btn.dataset.id; });
        saveData();
        renderHabitEditList(type);
        renderToday();
      });
    });
  }

  function genId(prefix) {
    return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function addHabit(type) {
    var input = document.getElementById(type === "good" ? "addGoodInput" : "addBadInput");
    var name = input.value.trim();
    if (!name) return;
    data.habits[type].push({ id: genId(type === "good" ? "g" : "b"), name: name });
    input.value = "";
    saveData();
    renderHabitEditList(type);
    renderToday();
  }

  /* ---------- google sheets sync ---------- */

  function syncToSheet() {
    var url = (data.settings.sheetUrl || "").trim();
    if (!url) {
      setStatus("saveStatus", "尚未設定 Google Sheets 網址,請到「設定」頁貼上", true);
      return Promise.resolve();
    }
    var record = getTodayRecord();
    persistTodayRecord(record);

    var payload = {
      date: todayKey(),
      score: record.score,
      good: data.habits.good.map(function (h) { return { name: h.name, value: record[h.id] }; }),
      bad: data.habits.bad.map(function (h) { return { name: h.name, value: record[h.id] ? 1 : 0 }; })
    };

    var syncBtn = document.getElementById("syncBtn");
    syncBtn.classList.add("spinning");

    return fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload)
    }).then(function () {
      setStatus("saveStatus", "已儲存並同步至 Google Sheets", false);
    }).catch(function () {
      setStatus("saveStatus", "已儲存在本機,但同步失敗(請檢查網路)", true);
    }).finally(function () {
      syncBtn.classList.remove("spinning");
    });
  }

  function restoreFromSheet() {
    var url = (data.settings.sheetUrl || "").trim();
    if (!url) {
      setStatus("settingsStatus", "請先儲存 Google Sheets 網址", true);
      return;
    }
    setStatus("settingsStatus", "讀取中...", false);

    fetch(url, { method: "GET" })
      .then(function (res) { return res.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length < 2) {
          setStatus("settingsStatus", "試算表中沒有資料", true);
          return;
        }
        var headers = rows[0];
        var dateIdx = headers.indexOf("日期");
        var scoreIdx = headers.indexOf("分數");
        var allHabits = data.habits.good.concat(data.habits.bad);
        var count = 0;

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var dateVal = row[dateIdx];
          if (!dateVal) continue;
          var key = normalizeDateValue(dateVal);
          if (!data.records[key]) data.records[key] = { date: key };
          var rec = data.records[key];

          headers.forEach(function (h, idx) {
            if (h === "日期") return;
            if (h === "分數") { rec.score = Number(row[idx]) || 0; return; }
            var habit = allHabits.find(function (x) { return x.name === h; });
            if (habit) rec[habit.id] = row[idx];
          });

          if (rec.score === undefined) rec.score = computeScore(rec);
          count++;
        }

        saveData();
        renderStats();
        renderToday();
        setStatus("settingsStatus", "已還原 " + count + " 筆紀錄", false);
      })
      .catch(function () {
        setStatus("settingsStatus", "讀取失敗,請確認網址是否正確", true);
      });
  }

  /* ---------- navigation ---------- */

  function switchView(view) {
    document.querySelectorAll(".view").forEach(function (v) { v.classList.add("hidden"); });
    document.getElementById("view-" + view).classList.remove("hidden");
    document.querySelectorAll(".nav-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === view);
    });
    if (view === "stats") renderStats();
    if (view === "settings") renderSettings();
  }

  function setDateDisplay() {
    var d = new Date();
    var weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    document.getElementById("todayDate").textContent = (d.getMonth() + 1) + "月" + d.getDate() + "日 星期" + weekday;
  }

  /* ---------- init ---------- */

  function init() {
    data = loadData();
    setDateDisplay();
    renderToday();

    document.querySelectorAll(".nav-btn").forEach(function (btn) {
      btn.addEventListener("click", function () { switchView(btn.dataset.view); });
    });

    document.getElementById("saveBtn").addEventListener("click", function () {
      persistTodayRecord(getTodayRecord());
      if (data.settings.sheetUrl) {
        syncToSheet();
      } else {
        setStatus("saveStatus", "已儲存在本機(尚未設定 Google Sheets 同步)", false);
      }
    });

    document.getElementById("syncBtn").addEventListener("click", syncToSheet);

    document.getElementById("addGoodBtn").addEventListener("click", function () { addHabit("good"); });
    document.getElementById("addBadBtn").addEventListener("click", function () { addHabit("bad"); });
    document.getElementById("addGoodInput").addEventListener("keydown", function (e) { if (e.key === "Enter") addHabit("good"); });
    document.getElementById("addBadInput").addEventListener("keydown", function (e) { if (e.key === "Enter") addHabit("bad"); });

    document.getElementById("btnTrend").addEventListener("click", function () {
      statsMode = "trend";
      this.classList.add("active");
      document.getElementById("btnRatio").classList.remove("active");
      renderChart(getLastNDays(14));
    });
    document.getElementById("btnRatio").addEventListener("click", function () {
      statsMode = "ratio";
      this.classList.add("active");
      document.getElementById("btnTrend").classList.remove("active");
      renderChart(getLastNDays(14));
    });

    document.getElementById("saveUrlBtn").addEventListener("click", function () {
      data.settings.sheetUrl = document.getElementById("sheetUrlInput").value.trim();
      saveData();
      setStatus("settingsStatus", "已儲存", false);
    });
    document.getElementById("restoreBtn").addEventListener("click", restoreFromSheet);

    document.getElementById("resetBtn").addEventListener("click", function () {
      if (!confirm("這會清除手機上儲存的所有習慣與紀錄,且無法復原。確定要繼續嗎？")) return;
      localStorage.removeItem(STORAGE_KEY);
      data = clone(DEFAULT_DATA);
      saveData();
      renderToday();
      switchView("today");
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
