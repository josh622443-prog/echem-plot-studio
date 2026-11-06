(() => {
  const panel = document.getElementById("data-library");
  panel.innerHTML = `
      <h2 id="library-title"></h2>
      <p id="library-help"></p>
      <div class="library-controls">
        <button id="library-pick" class="btn primary" type="button"></button>
        <input id="library-folder" type="file" webkitdirectory multiple hidden>
        <input id="library-search" type="search">
        <button id="library-compare" class="btn" type="button"></button>
      </div>
      <p id="library-status" role="status"></p>
      <div id="library-list"></div>
      <div class="library-pagination">
        <button id="library-prev" class="btn" type="button">‹</button>
        <span id="library-page"></span>
        <button id="library-next" class="btn" type="button">›</button>
      </div>`;

  const get = id => panel.querySelector("#library-" + id);
  const input = get("folder"), search = get("search"), list = get("list");
  const compare = get("compare"), prev = get("prev"), next = get("next");
  const massInput = document.getElementById("ndaxMassG");
  const hasNdax = Boolean(massInput && /^https?:$/.test(location.protocol)
    && ["127.0.0.1", "localhost"].includes(location.hostname));
  const supported = hasNdax ? /\.(csv|txt|xlsx?|ndax)$/i : /\.(csv|txt|xlsx?)$/i;
  const labels = {
    en: {
      title: "Data Library", pick: "Choose / refresh folder", search: "Search file or folder",
      compare: "Compare selected", open: "Open", select: "Select", prev: "Previous page", next: "Next page",
      help: "Choose your experiment folder. Files are read when opened or compared. Choose the folder again after reopening this page.",
      ndax: "NDAX opens individually. Set the active material mass in grams.",
      mass: "Active material mass (g)", busy: "A file is already loading.",
      empty: "No matching files", count: (shown, total, selected) => `${shown} of ${total} files · ${selected} selected`
    },
    "zh-TW": {
      title: "資料庫", pick: "選擇／重新掃描資料夾", search: "搜尋檔名或資料夾",
      compare: "比較勾選檔案", open: "開啟", select: "勾選", prev: "上一頁", next: "下一頁",
      help: "選擇實驗資料夾。只有開啟或比較時才讀取檔案。重新開啟網頁後請再選一次資料夾。",
      ndax: "NDAX 支援單檔開啟，請輸入該檔案的活性物質質量（g）。",
      mass: "活性物質質量（g）", busy: "正在讀取另一個檔案。",
      empty: "沒有符合的檔案", count: (shown, total, selected) => `${shown} / ${total} 個檔案 · 已選 ${selected} 個`
    },
    "zh-CN": {
      title: "数据库", pick: "选择／重新扫描文件夹", search: "搜索文件名或文件夹",
      compare: "比较勾选文件", open: "打开", select: "勾选", prev: "上一页", next: "下一页",
      help: "选择实验文件夹。只有打开或比较时才读取文件。重新打开网页后请再选一次文件夹。",
      ndax: "NDAX 支持单文件打开，请输入该文件的活性物质质量（g）。",
      mass: "活性物质质量（g）", busy: "正在读取另一个文件。",
      empty: "没有符合的文件", count: (shown, total, selected) => `${shown} / ${total} 个文件 · 已选 ${selected} 个`
    }
  };
  const words = () => labels[App.lang] || labels.en;
  const selected = new Set();
  const pageSize = 100;
  let entries = [], page = 0;

  function showTab(name) {
    document.querySelector(`.tabbtn[data-tab="${name}"]`).click();
  }

  function updateStatus(matches) {
    get("status").textContent = words().count(matches, entries.length, selected.size);
    compare.disabled = selected.size === 0;
  }

  function makeRow(entry, matches) {
    const {file, path, ndax} = entry;
    const w = words();
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;flex-wrap:wrap;gap:8px;border-top:1px solid var(--line);padding:8px 0";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.hidden = ndax;
    check.disabled = ndax;
    check.checked = selected.has(entry);
    check.setAttribute("aria-label", w.select + " " + path);
    check.addEventListener("change", () => {
      if (check.checked) selected.add(entry);
      else selected.delete(entry);
      updateStatus(matches);
    });
    const name = document.createElement("span");
    name.style.cssText = "flex:1 1 90px;min-width:0;overflow-wrap:anywhere";
    name.textContent = path;
    const size = document.createElement("small");
    size.textContent = file.size < 1024 * 1024
      ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn";
    open.textContent = w.open;
    open.setAttribute("aria-label", w.open + " " + path);
    row.append(check, name, size);
    let mass;
    if (ndax) {
      mass = document.createElement("input");
      mass.type = "number";
      mass.min = "0.000001";
      mass.step = "any";
      mass.required = true;
      mass.value = entry.mass;
      mass.placeholder = w.mass;
      mass.setAttribute("aria-label", w.mass + " " + path);
      mass.style.width = "128px";
      mass.addEventListener("input", () => { entry.mass = mass.value; });
      row.append(mass);
    }
    open.addEventListener("click", () => {
      if (dz.classList.contains("loading")) {
        get("status").textContent = w.busy;
        return;
      }
      if (mass) {
        if (!mass.reportValidity()) return;
        massInput.value = mass.value;
      }
      showTab("gcd");
      handleFiles(file);
    });
    row.append(open);
    return row;
  }

  function render() {
    const w = words();
    const query = search.value.trim().toLowerCase();
    const matches = entries.filter(entry => entry.key.includes(query));
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    page = Math.min(page, pages - 1);
    updateStatus(matches.length);
    list.replaceChildren();
    list.scrollTop = 0;
    if (!matches.length) list.textContent = w.empty;
    for (const entry of matches.slice(page * pageSize, (page + 1) * pageSize)) {
      list.append(makeRow(entry, matches.length));
    }
    get("page").textContent = `${page + 1} / ${pages}`;
    prev.disabled = page === 0;
    next.disabled = page + 1 === pages;
  }

  function localize() {
    const w = words();
    get("title").textContent = w.title;
    get("help").textContent = w.help + (hasNdax ? " " + w.ndax : "");
    get("pick").textContent = w.pick;
    compare.textContent = w.compare;
    search.placeholder = w.search;
    search.setAttribute("aria-label", w.search);
    prev.setAttribute("aria-label", w.prev);
    next.setAttribute("aria-label", w.next);
    render();
  }

  get("pick").addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    entries = Array.from(input.files).filter(file => supported.test(file.name)).map(file => {
      const path = file.webkitRelativePath || file.name;
      return {file, path, key: path.toLowerCase(), ndax: /\.ndax$/i.test(file.name), mass: ""};
    });
    entries.sort((left, right) => left.path.localeCompare(right.path, undefined, {numeric: true}));
    input.value = "";
    selected.clear();
    search.value = "";
    page = 0;
    render();
  });
  search.addEventListener("input", () => { page = 0; render(); });
  prev.addEventListener("click", () => { page -= 1; render(); });
  next.addEventListener("click", () => { page += 1; render(); });
  compare.addEventListener("click", () => {
    if (!selected.size) return;
    showTab("multicell");
    mcAddFiles(Array.from(selected, entry => entry.file));
    selected.clear();
    render();
  });
  document.getElementById("langSwitch").addEventListener("click", localize);
  localize();
})();
