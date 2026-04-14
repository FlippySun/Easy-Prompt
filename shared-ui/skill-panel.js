// ========================== 变更记录 ==========================
// [日期]     2026-04-13
// [类型]     新增
// [描述]     <ep-skill-panel> Web Component：Skill 选择浮窗。
//            Shadow DOM 内嵌 skill-panel.css 样式，按 skillType 分组渲染，
//            支持搜索过滤、键盘导航（↑↓/Enter/ESC）、点击外部关闭。
// [思路]     作为共享 UI 组件，Web 端和浏览器插件端通过 <script src> 引入。
//            数据通过 JS 属性 skills / skillTypeMap 设置，或通过 HTML 属性
//            传 JSON 字符串。事件：skill-select / panel-close。
// [影响范围] shared-ui/skill-panel.js（新文件）；依赖 skill-panel.css。
// [潜在风险] Web Component 是项目新模式，需验证两端加载兼容性。
// ==============================================================

(function () {
  "use strict";

  // --- 2026-04-13 CSS 内联：运行时 fetch skill-panel.css 或回退内联 ---
  // 获取当前脚本所在目录，用于相对路径加载 CSS
  const _currentScript = document.currentScript;
  const _scriptDir = _currentScript
    ? _currentScript.src.substring(0, _currentScript.src.lastIndexOf("/") + 1)
    : "";
  const _svgDataUrlCache = new Map();

  // 2026-04-13 修复：部分原始 SVG（如 folder 图标）缺少 xmlns，直接转成
  //   data URL 后在浏览器 mask 渲染链路中会失效。这里统一补齐命名空间，
  //   保证 parser-free 图标渲染在 Gemini/豆包等站点一致可见。
  // [参数与返回值] 输入原始 SVG 字符串，返回规范化后的 SVG 字符串。
  // [影响范围] shared-ui/skill-panel.js 所有基于 mask-image 的图标。
  // [潜在风险] 无已知风险。
  function _normalizeSvgSource(svgText) {
    const raw = String(svgText || "").trim();
    if (!raw) return "";
    if (/^<svg\b/i.test(raw) && !/\bxmlns=/.test(raw)) {
      return raw.replace(/^<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return raw;
  }

  function _svgToDataUrl(svgText) {
    if (!svgText) return "";
    const normalizedSvg = _normalizeSvgSource(svgText);
    if (_svgDataUrlCache.has(normalizedSvg)) {
      return _svgDataUrlCache.get(normalizedSvg);
    }
    const dataUrl = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      normalizedSvg,
    )}")`;
    _svgDataUrlCache.set(normalizedSvg, dataUrl);
    return dataUrl;
  }

  // --- 2026-04-13 修复：统一解析 CustomElementRegistry，避免打包/内容脚本环境中 ---
  //   裸用 customElements 触发 null.get。
  // [参数与返回值] 无参数；返回 CustomElementRegistry|null。
  // [影响范围] shared-ui/skill-panel.js 自定义元素注册路径。
  // [潜在风险] 无已知风险。
  function _getCustomElementRegistry() {
    if (typeof globalThis !== "undefined" && globalThis.customElements) {
      return globalThis.customElements;
    }
    if (typeof window !== "undefined" && window.customElements) {
      return window.customElements;
    }
    if (
      typeof document !== "undefined" &&
      document.defaultView &&
      document.defaultView.customElements
    ) {
      return document.defaultView.customElements;
    }
    return null;
  }

  /**
   * <ep-skill-panel> 自定义元素
   *
   * 属性 (HTML attributes):
   *   skills          — JSON 字符串，技能数组
   *   skill-type-map  — JSON 字符串，分组名映射 { "1": "通用", ... }
   *   icon-map        — JSON 字符串，icon 名称 → SVG 字符串映射
   *   folder-icon     — string，分类标题前的 folder 图标 SVG
   *   visible         — boolean，控制显隐
   *   filter          — string，搜索关键词
   *
   * JS 属性:
   *   .skills         — Array，技能数据
   *   .skillTypeMap   — Object，分组名映射
   *   .iconMap        — Object，icon 名称 → SVG 字符串映射
   *   .folderIcon     — string，分类标题前的 folder 图标 SVG
   *   .visible        — boolean
   *   .filter         — string
   *
   * 静态方法:
   *   EpSkillPanel.injectCss(cssText) — 预注入 CSS 文本（供打包环境使用）
   *
   * 事件:
   *   skill-select    — CustomEvent({ detail: skill })
   *   panel-close     — CustomEvent()
   *
   * 键盘导航: ↑↓ 移动高亮、Enter 选中、ESC 关闭
   */
  class EpSkillPanel extends HTMLElement {
    // --- 2026-04-13 静态 CSS 注入：供 Vite/WXT 等打包环境预注入 CSS 文本 ---
    static _injectedCss = "";
    static injectCss(cssText) {
      EpSkillPanel._injectedCss = cssText || "";
    }
    constructor() {
      super();
      this.attachShadow({ mode: "open" });

      // --- 内部状态 ---
      this._skills = [];
      this._skillTypeMap = { 1: "通用", 2: "写作", 3: "制图", 4: "编程" };
      this._iconMap = {}; // icon 名称 → SVG 字符串映射
      this._folderIcon = ""; // 分类标题前的 folder 图标 SVG
      this._filter = "";
      this._visible = false;
      this._activeIndex = -1; // 当前键盘高亮的 item 索引（在 filteredItems 中）
      this._filteredItems = []; // 扁平化的过滤后 skill 列表（用于键盘导航）
      this._animateOnNextRender = false;
      this._styleNode = null;
      this._containerNode = null;
      this._scrollNode = null;
      this._onContainerAnimationEnd = () => {
        if (this._containerNode) {
          this._containerNode.classList.remove("is-opening");
        }
      };

      // --- 外部点击关闭处理器（绑定 this） ---
      this._onDocumentClick = (e) => {
        if (this._visible && !this.contains(e.target)) {
          this._close();
        }
      };

      // --- 键盘事件处理器 ---
      this._onKeyDown = (e) => {
        if (!this._visible) return;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            e.stopPropagation();
            this._moveActive(1);
            break;
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            this._moveActive(-1);
            break;
          case "Enter":
            e.preventDefault();
            e.stopPropagation();
            this._selectActive();
            break;
          case "Escape":
            e.preventDefault();
            e.stopPropagation();
            this._close();
            break;
        }
      };

      this._cssLoaded = false;
      this._cssText = ""; // 缓存加载的 CSS 文本
    }

    // --- 监听的 HTML 属性 ---
    static get observedAttributes() {
      return [
        "skills",
        "skill-type-map",
        "icon-map",
        "folder-icon",
        "visible",
        "filter",
      ];
    }

    attributeChangedCallback(name, oldVal, newVal) {
      switch (name) {
        case "skills":
          try {
            this._skills = JSON.parse(newVal) || [];
          } catch {
            this._skills = [];
          }
          this._render();
          break;
        case "skill-type-map":
          try {
            this._skillTypeMap = JSON.parse(newVal) || {};
          } catch {
            /* keep default */
          }
          this._render();
          break;
        case "icon-map":
          try {
            this._iconMap = JSON.parse(newVal) || {};
          } catch {
            this._iconMap = {};
          }
          this._render();
          break;
        case "folder-icon":
          this._folderIcon = newVal || "";
          this._render();
          break;
        case "visible":
          this._visible = newVal !== null && newVal !== "false";
          this._onVisibilityChange();
          break;
        case "filter":
          // 2026-04-14 修复：Gemini 等 contenteditable 站点会在一次输入后同时触发
          //   input + keyup，导致 content.js 可能重复写入同一个 filter。这里对相同值
          //   做幂等短路，避免无意义重渲染把键盘高亮重置掉并造成闪烁。
          // [参数与返回值] oldVal/newVal 为 attribute 旧值/新值；相同值时直接返回。
          // [影响范围] shared-ui/skill-panel.js 过滤、键盘导航、Gemini 交互稳定性。
          // [潜在风险] 无已知风险。
          if ((oldVal || "") === (newVal || "")) {
            break;
          }
          this._filter = newVal || "";
          this._activeIndex = -1;
          this._render();
          break;
      }
    }

    // --- JS 属性访问器 ---
    get skills() {
      return this._skills;
    }
    set skills(val) {
      this._skills = Array.isArray(val) ? val : [];
      this._render();
    }

    get skillTypeMap() {
      return this._skillTypeMap;
    }
    set skillTypeMap(val) {
      if (val && typeof val === "object") this._skillTypeMap = val;
      this._render();
    }

    get visible() {
      return this._visible;
    }
    set visible(val) {
      this._visible = !!val;
      this._onVisibilityChange();
    }

    get filter() {
      return this._filter;
    }
    set filter(val) {
      const nextFilter = val || "";
      if (this._filter === nextFilter) {
        return;
      }
      this._filter = nextFilter;
      this._activeIndex = -1;
      this._render();
    }

    // 2026-04-13 新增：图标映射（icon 名称 → SVG 字符串）
    get iconMap() {
      return this._iconMap;
    }
    set iconMap(val) {
      if (val && typeof val === "object") this._iconMap = val;
      this._render();
    }

    // 2026-04-13 新增：分类标题 folder 图标 SVG
    get folderIcon() {
      return this._folderIcon;
    }
    set folderIcon(val) {
      this._folderIcon = val || "";
      this._render();
    }

    // --- 生命周期 ---
    async connectedCallback() {
      // 加载 CSS
      if (!this._cssLoaded) {
        await this._loadCSS();
        this._cssLoaded = true;
      }
      this._render();
      // 延迟绑定外部点击（避免触发自身的 click 事件）
      setTimeout(() => {
        document.addEventListener("click", this._onDocumentClick, true);
      }, 0);
    }

    disconnectedCallback() {
      document.removeEventListener("click", this._onDocumentClick, true);
      document.removeEventListener("keydown", this._onKeyDown, true);
      if (this._containerNode) {
        this._containerNode.removeEventListener(
          "animationend",
          this._onContainerAnimationEnd,
        );
      }
    }

    // --- CSS 加载：优先使用静态注入的 CSS，其次 fetch 同目录文件 ---
    async _loadCSS() {
      // 优先使用 injectCss() 预注入的 CSS 文本（打包环境）
      if (EpSkillPanel._injectedCss) {
        this._cssText = EpSkillPanel._injectedCss;
        return;
      }
      // 回退：运行时 fetch 同目录 skill-panel.css（<script src> 引入场景）
      try {
        const cssUrl = _scriptDir + "skill-panel.css";
        const resp = await fetch(cssUrl);
        if (resp.ok) {
          this._cssText = await resp.text();
        }
      } catch {
        // 静默失败，使用空样式
        this._cssText = "";
      }
    }

    // --- 显隐切换 ---
    _onVisibilityChange() {
      if (this._visible) {
        this._activeIndex = -1;
        this._animateOnNextRender = true;
        this._render();
        document.addEventListener("keydown", this._onKeyDown, true);
      } else {
        document.removeEventListener("keydown", this._onKeyDown, true);
        this._animateOnNextRender = false;
        this._render();
      }
    }

    // --- 关闭浮窗 ---
    _close() {
      this._visible = false;
      this._onVisibilityChange();
      this.dispatchEvent(
        new CustomEvent("panel-close", { bubbles: true, composed: true }),
      );
    }

    // --- 键盘导航：移动 active ---
    _moveActive(delta) {
      if (this._filteredItems.length === 0) return;
      let next = this._activeIndex + delta;
      if (next < 0) next = this._filteredItems.length - 1;
      if (next >= this._filteredItems.length) next = 0;
      this._activeIndex = next;
      this._updateActiveHighlight();
    }

    // --- 键盘导航：选中 active ---
    _selectActive() {
      if (
        this._activeIndex >= 0 &&
        this._activeIndex < this._filteredItems.length
      ) {
        this._emitSelect(this._filteredItems[this._activeIndex]);
      }
    }

    // --- 发送选中事件 ---
    _emitSelect(skill) {
      this.dispatchEvent(
        new CustomEvent("skill-select", {
          detail: skill,
          bubbles: true,
          composed: true,
        }),
      );
      this._close();
    }

    // --- 更新 active 高亮（不重建 DOM，只切换 class） ---
    _updateActiveHighlight() {
      const items = this.shadowRoot.querySelectorAll(".skill-item");
      items.forEach((el, i) => {
        el.classList.toggle("active", i === this._activeIndex);
      });
      // 滚动到可见区域
      const activeEl = items[this._activeIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }

    // --- 过滤技能 ---
    _getFilteredSkills() {
      if (!this._filter) return this._skills;
      const lower = this._filter.toLowerCase();
      return this._skills.filter(
        (s) =>
          s.name.toLowerCase().includes(lower) ||
          s.description.toLowerCase().includes(lower),
      );
    }

    // --- 按 skillType 分组 ---
    _groupByType(skills) {
      const grouped = {};
      for (const skill of skills) {
        const type = String(skill.skillType);
        if (!grouped[type]) {
          grouped[type] = {
            typeName: this._skillTypeMap[type] || type,
            skills: [],
          };
        }
        grouped[type].skills.push(skill);
      }
      return grouped;
    }

    // --- 2026-04-13 修复：Trusted Types 页面禁止 shadowRoot.innerHTML， ---
    //   改为纯 DOM API 构建 Shadow DOM 内容，兼容 Gemini 等启用 TrustedHTML 的站点。
    // [参数与返回值] 返回 style/svg/DOM 节点供 _render() 直接挂载。
    // [影响范围] shared-ui/skill-panel.js 渲染主链路与图标渲染。
    // [潜在风险] 无已知风险。
    _createStyleNode() {
      const style = document.createElement("style");
      style.textContent = this._cssText;
      return style;
    }

    // 2026-04-14 重构：保持 Shadow DOM 外壳稳定，只更新列表滚动区内容，
    //   避免每次 filter 变化都重建整块 panel 导致 backdrop/filter/shadow 整窗闪烁。
    // [参数与返回值] 无参数；返回复用后的 container/scroll 节点引用。
    // [影响范围] shared-ui/skill-panel.js 所有渲染路径、过滤交互、开场动画触发时机。
    // [潜在风险] 无已知风险。
    _ensureStructure() {
      if (!this.shadowRoot) return null;

      if (!this._styleNode) {
        this._styleNode = this._createStyleNode();
      }
      if (this._styleNode.textContent !== this._cssText) {
        this._styleNode.textContent = this._cssText;
      }

      if (!this._containerNode) {
        this._containerNode = document.createElement("div");
        this._containerNode.className = "skill-container";
        this._containerNode.addEventListener(
          "animationend",
          this._onContainerAnimationEnd,
        );
      }

      if (!this._scrollNode) {
        this._scrollNode = document.createElement("div");
        this._scrollNode.className = "skill-scroll";
      }

      if (!this._containerNode.contains(this._scrollNode)) {
        this._containerNode.appendChild(this._scrollNode);
      }

      if (
        !this._styleNode.isConnected ||
        !this._containerNode.isConnected ||
        this.shadowRoot.firstChild !== this._styleNode ||
        this.shadowRoot.lastChild !== this._containerNode
      ) {
        this.shadowRoot.replaceChildren(this._styleNode, this._containerNode);
      }

      return {
        container: this._containerNode,
        scroll: this._scrollNode,
      };
    }

    _createMaskIconNode(svgText, sizePx = 14) {
      const dataUrl = _svgToDataUrl(svgText);
      if (!dataUrl) return null;
      const icon = document.createElement("span");
      icon.className = "ep-mask-icon";
      icon.style.display = "inline-block";
      icon.style.width = `${sizePx}px`;
      icon.style.height = `${sizePx}px`;
      icon.style.minWidth = `${sizePx}px`;
      icon.style.flexShrink = "0";
      icon.style.backgroundColor = "currentColor";
      icon.style.webkitMaskImage = dataUrl;
      icon.style.maskImage = dataUrl;
      icon.style.webkitMaskRepeat = "no-repeat";
      icon.style.maskRepeat = "no-repeat";
      icon.style.webkitMaskSize = "contain";
      icon.style.maskSize = "contain";
      icon.style.webkitMaskPosition = "center";
      icon.style.maskPosition = "center";
      return icon;
    }

    _appendSvgOrText(container, svgText, fallbackText, sizePx = 14) {
      const iconNode = this._createMaskIconNode(svgText, sizePx);
      if (iconNode) {
        container.appendChild(iconNode);
        return;
      }
      container.textContent = fallbackText || "";
    }

    _buildCategoryNode(typeName) {
      const category = document.createElement("div");
      category.className = "skill-category";
      if (this._folderIcon) {
        const iconWrap = document.createElement("span");
        iconWrap.className = "skill-category-icon";
        this._appendSvgOrText(iconWrap, this._folderIcon, "", 12);
        if (iconWrap.childNodes.length > 0) {
          category.appendChild(iconWrap);
        }
      }
      category.appendChild(document.createTextNode(typeName || ""));
      return category;
    }

    _buildSkillItemNode(skill, itemIndex, isActive) {
      const item = document.createElement("div");
      item.className = `skill-item${isActive ? " active" : ""}`;
      item.dataset.index = String(itemIndex);

      const icon = document.createElement("div");
      icon.className = "skill-icon";
      const iconSvg = skill?.icon ? this._iconMap[skill.icon] : "";
      this._appendSvgOrText(icon, iconSvg, skill?.icon || "?", 14);

      const info = document.createElement("div");
      info.className = "skill-info";

      const name = document.createElement("div");
      name.className = "skill-name";
      name.textContent = skill?.name || "";

      const desc = document.createElement("div");
      desc.className = "skill-desc";
      desc.textContent = skill?.description || "";

      info.appendChild(name);
      info.appendChild(desc);
      item.appendChild(icon);
      item.appendChild(info);
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (itemIndex >= 0 && itemIndex < this._filteredItems.length) {
          this._emitSelect(this._filteredItems[itemIndex]);
        }
      });
      return item;
    }

    // --- 主渲染 ---
    _render() {
      if (!this.shadowRoot) return;
      const structure = this._ensureStructure();
      if (!structure) return;
      const { container, scroll } = structure;

      // 2026-04-14 修复：共享 skill-panel 为消除过滤闪烁会稳定复用 container。
      //   但 Web 端会在初始化阶段提前把 <ep-skill-panel> 挂进 DOM；若 !visible 时仅清空
      //   scroll 而不隐藏 container，则 border / padding / 背景仍会渲染成一个空白浮窗。
      // [类型]     修复
      // [描述]     将不可见态从“空内容”升级为“真正隐藏复用外壳”，仅在 visible=true 时显示。
      // [思路]     继续复用同一个 container / scroll 节点，避免回退到整块外壳重建引发闪烁。
      // [参数与返回值] 读取 this._visible 控制 container.hidden；无新增参数与返回值。
      // [影响范围] shared-ui/skill-panel.js；Web / Browser 两端未唤起态与唤起态显示路径。
      // [潜在风险] 无已知风险。
      // 不可见时隐藏
      if (!this._visible) {
        this._filteredItems = [];
        container.hidden = true;
        container.classList.remove("is-opening");
        scroll.replaceChildren();
        return;
      }

      container.hidden = false;

      const filtered = this._getFilteredSkills();
      const grouped = this._groupByType(filtered);

      // 构建扁平 item 列表（用于键盘导航索引）
      this._filteredItems = [];
      const groupKeys = Object.keys(grouped).sort();
      for (const key of groupKeys) {
        for (const skill of grouped[key].skills) {
          this._filteredItems.push(skill);
        }
      }

      if (this._animateOnNextRender) {
        container.classList.add("is-opening");
        this._animateOnNextRender = false;
      }

      const nextNodes = [];

      if (this._filteredItems.length === 0) {
        const empty = document.createElement("div");
        empty.className = "skill-empty";
        empty.textContent = "无匹配技能";
        nextNodes.push(empty);
      } else {
        let itemIndex = 0;
        for (const key of groupKeys) {
          const group = grouped[key];
          nextNodes.push(this._buildCategoryNode(group.typeName));
          for (const skill of group.skills) {
            const isActive = itemIndex === this._activeIndex;
            nextNodes.push(
              this._buildSkillItemNode(skill, itemIndex, isActive),
            );
            itemIndex++;
          }
        }
      }

      scroll.replaceChildren(...nextNodes);
    }
  }

  // --- 注册自定义元素 ---
  // 2026-04-13 修复：WXT/Vite 打包 content script 时，IIFE 通过 CommonJS
  //   兼容层执行，customElements 全局变量在该作用域中可能为 null。
  //   包裹 try/catch 防止崩溃，并始终通过 globalThis 暴露类，
  //   让消费者（如 browser/content.js）可在自身作用域中手动注册。
  // [影响范围] shared-ui/skill-panel.js + browser/content/content.js
  // [潜在风险] 无——Web 端 <script> / Vite 静态 import 仍走 try 分支正常注册
  const _customElementRegistry = _getCustomElementRegistry();
  try {
    if (
      _customElementRegistry &&
      !_customElementRegistry.get("ep-skill-panel")
    ) {
      _customElementRegistry.define("ep-skill-panel", EpSkillPanel);
    }
  } catch {
    // 静默：打包环境中 customElements 不可达，由消费者手动注册
  }
  // 始终暴露类，供打包环境手动注册
  if (typeof globalThis !== "undefined") {
    globalThis.__EpSkillPanelClass = EpSkillPanel;
  }
})();
