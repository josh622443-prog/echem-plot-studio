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
      <nav id="library-location" hidden>
        <div class="library-navigation">
          <button id="library-back" class="btn" type="button">←</button>
          <button id="library-forward" class="btn" type="button">→</button>
          <button id="library-up" class="btn" type="button">↑</button>
        </div>
        <div id="library-path"></div>
      </nav>
      <p id="library-status" role="status"></p>
      <div id="library-list">
        <div class="library-details library-head"><span id="library-name"></span><span id="library-modified"></span></div>
        <div id="library-rows"></div>
      </div>
      <div class="library-pagination">
        <button id="library-prev" class="btn" type="button">‹</button>
        <span id="library-page"></span>
        <button id="library-next" class="btn" type="button">›</button>
      </div>`;

  const get = id => panel.querySelector("#library-" + id);
  const input = get("folder"), search = get("search"), list = get("list");
  const rowList = get("rows"), back = get("back"), forward = get("forward");
  const compare = get("compare"), prev = get("prev"), next = get("next");
  const up = get("up"), locationNav = get("location"), breadcrumb = get("path");
  const massInput = document.getElementById("ndaxMassG");
  const hasNdax = Boolean(massInput && /^https?:$/.test(location.protocol)
    && ["127.0.0.1", "localhost"].includes(location.hostname));
  const supported = hasNdax ? /\.(csv|txt|xlsx?|ndax)$/i : /\.(csv|txt|xlsx?)$/i;
  const labels = {
    en: {
      title: "Data Library", pick: "Choose / refresh folder", search: "Search file or folder",
      compare: "Compare selected", open: "Open", select: "Select", prev: "Previous page", next: "Next page",
      up: "Up one folder", back: "Back", forward: "Forward", name: "Name", modified: "Date modified",
      location: "Folder path", root: "Selected folder",
      help: "Choose your experiment folder. Files are read when opened or compared. Choose the folder again after reopening this page.",
      ndax: "NDAX opens individually. Set the active material mass in grams.",
      mass: "Active material mass (g)", busy: "A file is already loading.",
      empty: "No matching files", count: (shown, total, selected) => `${shown} of ${total} files · ${selected} selected`
    },
    "zh-TW": {
      title: "資料庫", pick: "選擇／重新掃描資料夾", search: "搜尋檔名或資料夾",
      compare: "比較勾選檔案", open: "開啟", select: "勾選", prev: "上一頁", next: "下一頁",
      up: "上一層", back: "返回", forward: "前進", name: "名稱", modified: "修改時間",
      location: "資料夾路徑", root: "所選資料夾",
      help: "選擇實驗資料夾。只有開啟或比較時才讀取檔案。重新開啟網頁後請再選一次資料夾。",
      ndax: "NDAX 支援單檔開啟，請輸入該檔案的活性物質質量（g）。",
      mass: "活性物質質量（g）", busy: "正在讀取另一個檔案。",
      empty: "沒有符合的檔案", count: (shown, total, selected) => `${shown} / ${total} 個檔案 · 已選 ${selected} 個`
    },
    "zh-CN": {
      title: "数据库", pick: "选择／重新扫描文件夹", search: "搜索文件名或文件夹",
      compare: "比较勾选文件", open: "打开", select: "勾选", prev: "上一页", next: "下一页",
      up: "上一级", back: "返回", forward: "前进", name: "名称", modified: "修改时间",
      location: "文件夹路径", root: "所选文件夹",
      help: "选择实验文件夹。只有打开或比较时才读取文件。重新打开网页后请再选一次文件夹。",
      ndax: "NDAX 支持单文件打开，请输入该文件的活性物质质量（g）。",
      mass: "活性物质质量（g）", busy: "正在读取另一个文件。",
      empty: "没有符合的文件", count: (shown, total, selected) => `${shown} / ${total} 个文件 · 已选 ${selected} 个`
    }
  };
  const words = () => labels[App.lang] || labels.en;
  const selected = new Set();
  const pageSize = 100;
  let entries = [], page = 0, root = null, currentFolder;
  let folderHistory = [], historyIndex = -1;
  let dateFormat;

  function showTab(name) {
    document.querySelector(`.tabbtn[data-tab="${name}"]`).click();
  }

  function updateStatus(matches) {
    get("status").textContent = words().count(matches, entries.length, selected.size);
    compare.disabled = selected.size === 0;
  }

  function makeRow(entry, matches, showPath) {
    const {file, path, ndax} = entry;
    const w = words();
    const row = document.createElement("div");
    row.className = "library-details library-entry";
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
    const nameCell = document.createElement("div");
    nameCell.className = "library-entry-name";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "library-name-button";
    open.textContent = "📄 " + (showPath ? path : file.name);
    open.title = path;
    open.setAttribute("aria-label", w.open + " " + path);
    nameCell.append(check, open);
    const modified = document.createElement("time");
    if (file.lastModified > 0) {
      const date = new Date(file.lastModified);
      modified.dateTime = date.toISOString();
      modified.textContent = dateFormat.format(date);
    } else {
      modified.textContent = "—";
    }
    row.append(nameCell, modified);
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
      }
      showTab("gcd");
      handleFiles(file, mass?.value);
    });
    return row;
  }

  function goToFolder(folder) {
    if (currentFolder === folder) return;
    folderHistory = folderHistory.slice(0, historyIndex + 1);
    folderHistory.push(folder);
    showFolderAt(folderHistory.length - 1);
  }

  function showFolderAt(index) {
    if (!folderHistory[index]) return;
    historyIndex = index;
    currentFolder = folderHistory[index];
    search.value = "";
    page = 0;
    render();
  }

  function renderLocation() {
    locationNav.hidden = !root;
    if (!root) return;
    up.disabled = currentFolder === root;
    back.disabled = historyIndex === 0;
    forward.disabled = historyIndex === folderHistory.length - 1;
    const ancestors = [];
    for (let folder = currentFolder; folder; folder = folder.parent) ancestors.unshift(folder);
    breadcrumb.replaceChildren();
    for (const folder of ancestors) {
      if (folder === currentFolder) {
        const label = document.createElement("span");
        label.textContent = folder.name || words().root;
        label.setAttribute("aria-current", "location");
        breadcrumb.append(label);
      } else {
        const button = document.createElement("button");
        button.className = "btn";
        button.type = "button";
        button.textContent = folder.name || words().root;
        button.addEventListener("click", () => goToFolder(folder));
        breadcrumb.append(button);
      }
    }
  }

  function makeFolderRow(folder) {
    const row = document.createElement("div");
    row.className = "library-details library-entry";
    const button = document.createElement("button");
    button.className = "library-name-button library-folder-row";
    button.type = "button";
    button.textContent = "📁 " + folder.name;
    button.addEventListener("click", () => goToFolder(folder));
    const modified = document.createElement("span");
    modified.textContent = "—";
    row.append(button, modified);
    return row;
  }

  function render() {
    const w = words();
    const query = search.value.trim().toLowerCase();
    const matches = query ? entries.filter(entry => entry.key.includes(query)) : currentFolder?.files || [];
    const folders = query || !currentFolder ? [] : Array.from(currentFolder.children.values());
    const rows = [...folders, ...matches];
    const pages = Math.max(1, Math.ceil(rows.length / pageSize));
    page = Math.min(page, pages - 1);
    updateStatus(matches.length);
    rowList.replaceChildren();
    list.scrollTop = 0;
    renderLocation();
    if (!rows.length) rowList.textContent = w.empty;
    for (const item of rows.slice(page * pageSize, (page + 1) * pageSize)) {
      rowList.append(item.file ? makeRow(item, matches.length, Boolean(query)) : makeFolderRow(item));
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
    dateFormat = new Intl.DateTimeFormat(App.lang, {dateStyle: "short", timeStyle: "short"});
    for (const [button, label] of [[up, w.up], [back, w.back], [forward, w.forward]]) {
      button.title = label;
      button.setAttribute("aria-label", label);
    }
    get("name").textContent = w.name;
    get("modified").textContent = w.modified;
    locationNav.setAttribute("aria-label", w.location);
    compare.textContent = w.compare;
    search.placeholder = w.search;
    search.setAttribute("aria-label", w.search);
    prev.setAttribute("aria-label", w.prev);
    next.setAttribute("aria-label", w.next);
    render();
  }

  get("pick").addEventListener("click", () => input.click());
  up.addEventListener("click", () => { if (currentFolder?.parent) goToFolder(currentFolder.parent); });
  back.addEventListener("click", () => showFolderAt(historyIndex - 1));
  forward.addEventListener("click", () => showFolderAt(historyIndex + 1));
  input.addEventListener("change", () => {
    root = {name: "", children: new Map(), files: [], parent: null};
    entries = [];
    const files = Array.from(input.files).sort((left, right) =>
      (left.webkitRelativePath || left.name).localeCompare(right.webkitRelativePath || right.name, undefined, {numeric: true}));
    for (const file of files) {
      const path = file.webkitRelativePath || file.name;
      const parts = path.split("/");
      if (parts.length > 1) root.name = parts.shift();
      parts.pop();
      let folder = root;
      for (const name of parts) {
        if (!folder.children.has(name)) {
          folder.children.set(name, {name, children: new Map(), files: [], parent: folder});
        }
        folder = folder.children.get(name);
      }
      if (!supported.test(file.name)) continue;
      const ndax = /\.ndax$/i.test(file.name);
      const entry = {file, path, key: path.toLowerCase(), ndax, mass: ndax ? ndaxMassFromFilename(file.name) : ""};
      entries.push(entry);
      folder.files.push(entry);
    }
    input.value = "";
    selected.clear();
    folderHistory = [root];
    showFolderAt(0);
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
