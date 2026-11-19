/* 文档运行时：双站共享导航、TOC 帧调度和搜索索引加载，不包含语言文案。 */
;(function (window, document, $) {
  'use strict'
  var items = [], positions = [], dirty = true, frame = 0, active = null
  var pendingHash = null, initialized = false, articleObserver = null
  var requestFrame = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16) }
  var searchRequest = null
  var classRequests = Object.create(null), classQueue = [], classActive = 0
  var classXhrs = []

  function fetchClassHtml(href) {
    var key = new URL(href, window.location.href).href
    if (classRequests[key]) return classRequests[key].promise()
    var deferred = classRequests[key] = $.Deferred()
    classQueue.push({ key: key, deferred: deferred })
    pumpClasses()
    return deferred.promise()
  }

  function pumpClasses() {
    while (classActive < 3 && classQueue.length) {
      var job = classQueue.shift()
      classActive++
      ;(function (job) {
        var xhr = $.ajax({ url: job.key, dataType: 'html', cache: true, timeout: 12000 })
          .done(function (html) { job.deferred.resolve(html) })
          .fail(function () { delete classRequests[job.key]; job.deferred.reject() })
          .always(function () {
            var i = classXhrs.indexOf(xhr)
            // 已被 detachPage 清理（切页取消）的请求不再参与新页面的计数与队列调度
            if (i < 0) return
            classXhrs.splice(i, 1)
            classActive--
            pumpClasses()
          })
        classXhrs.push(xhr)
      })(job)
    }
  }

  // 左侧菜单按需物化：构建期把非当前分支的子菜单转成内联数据，
  // 展开时在此本地创建节点，不产生网络请求。脚本缺失时静态部分仍可用。
  var sidebarTree = null
  function sidebarData() {
    if (sidebarTree !== null) return sidebarTree
    sidebarTree = null
    var node = document.getElementById('sidebar-tree-data')
    if (!node) return null
    try { sidebarTree = JSON.parse(node.textContent || '') } catch (e) { sidebarTree = null }
    return sidebarTree
  }

  function buildBranch(items) {
    var $ul = $('<ul class="sub-menu"></ul>')
    items.forEach(function (item) {
      var title = item[0] || ''
      var docPath = item[1] || ''
      var $dd = $('<dd></dd>')
      var kids = item[2] || null
      var $a
      if (kids && kids.length) {
        $a = $('<a class="sub-toggle"></a>')
        $a.attr('data-doc-path', docPath)
        $a.text(title)
        $a.append('<i class="fa fa-angle-down"></i><i class="fa fa-angle-up"></i>')
        $dd.append($a)
        $dd.append(buildBranch(kids))
      } else {
        $a = $('<a></a>')
        $a.attr('data-doc-path', docPath)
        // href 由导航初始化按部署根推导；此处先留空避免拼错根
        $a.attr('href', '')
        $a.text(title)
        $dd.append($a)
      }
      $ul.append($dd)
    })
    return $ul
  }

  // 取出并物化指定分支；返回是否成功
  function materializeBranch($toggle) {
    var $dd = $toggle.closest('dd')
    if (!$dd.length) return false
    if ($dd.children('ul.sub-menu').length) return true
    var key = $dd.attr('data-branch')
    if (!key) return false
    var tree = sidebarData()
    if (!tree) return false
    var parts = String(key).split('-')
    var group = tree[parts[0]]
    if (!group) return false
    var items = group[Number(parts[1])]
    if (!items || !items.length) return false
    $dd.append(buildBranch(items))
    // 新节点需要与既有菜单一致的部署根解析
    if (window.DocNavigation && window.DocNavigation.refreshSidebarLinks) {
      window.DocNavigation.refreshSidebarLinks($dd)
    }
    $dd.removeAttr('data-branch')
    return true
  }

  function containsPath(items, docPath) {
    for (var i = 0; i < items.length; i++) {
      if (items[i][1] === docPath) return true
      if (items[i][2] && containsPath(items[i][2], docPath)) return true
    }
    return false
  }

  // 导航到尚未物化的分支时，先把它展开出来，否则侧栏高亮找不到目标链接
  function materializeFor(docPath) {
    if (!docPath) return false
    var tree = sidebarData()
    if (!tree) return false
    var $branches = $('.site-sidebar dd[data-branch]')
    var done = false
    $branches.each(function () {
      if (done) return
      var $dd = $(this)
      var key = String($dd.attr('data-branch') || '')
      var parts = key.split('-')
      var group = tree[parts[0]]
      if (!group) return
      var items = group[Number(parts[1])]
      if (!items) return
      var $toggle = $dd.children('a.sub-toggle').first()
      if (!$toggle.length) return
      // 目标可能是该分支自身主页，也可能在其子树里，两者都要物化
      var selfPath = $toggle.attr('data-doc-path') || ''
      if (!(selfPath === docPath || containsPath(items, docPath))) return
      if (materializeBranch($toggle)) {
        $toggle.addClass('active')
        done = true
      }
    })
    return done
  }

  function rebaseLinks($content, href) {
    var base = new URL(href, window.location.href)
    $content.find('[href], [src]').each(function () {
      var node = this
      ;['href', 'src'].forEach(function (attr) {
        var value = node.getAttribute(attr)
        if (!value || /^(?:data:|javascript:|mailto:)/i.test(value)) return
        var target = new URL(value, base)
        if (window.DocNavigation && window.DocNavigation.canVisit(href)) {
          node.setAttribute(attr, target.href)
          return
        }
        if (target.origin !== window.location.origin || target.protocol !== window.location.protocol) {
          node.setAttribute(attr, target.href)
          return
        }
        var from = window.location.pathname.split('/'); from.pop()
        var to = target.pathname.split('/')
        while (from.length && to.length && from[0] === to[0]) { from.shift(); to.shift() }
        node.setAttribute(attr, from.map(function () { return '..' }).concat(to).join('/') + target.search + target.hash)
      })
    })
  }

  function plainClick(e) {
    return !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && (!e.which || e.which === 1) && (!e.button || e.button === 0)
  }

  function resolveTarget(hash) {
    var id
    try { id = decodeURIComponent(String(hash || '').replace(/^#/, '')) } catch (e) { return null }
    if (!id) return null
    var pageUrl = window.DocNavigation ? window.DocNavigation.currentUrl() : window.location.href
    var el = document.getElementById(id) || document.getElementById(id.toLowerCase())
    if (el && $(el).hasClass('api-row')) {
      var triggerHref = $(el).find('a.trigger').first().attr('href')
      var inlineId = $(el).attr('data-class-inline-id') || (triggerHref ? new URL(triggerHref, pageUrl).hash.slice(1) : '') || el.id + '_inline'
      el = document.getElementById(inlineId) || el
    }
    if (!el) el = document.getElementById(id + '_inline')
    // 历史类级 UID 指向无 ID 的 h1，映射到 Overview；不改其他锚点大小写。
    var page = new URL(pageUrl).pathname.split('/').pop().replace(/\.html$/i, '').toLowerCase()
    if (!el && id.toLowerCase() === page) el = document.getElementById('ifm-overview')
    return el
  }

  function headerOffset() {
    var bottom = 0
    $('#site-header, .sub-nav').each(function () {
      var rect = this.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top <= 1) bottom = Math.max(bottom, rect.bottom)
    })
    // 常规页面滚动后副导航吸顶为 50px，保留既定 80px 阅读偏移。
    return Math.max(80, bottom + 16)
  }

  function navigate(hash, options) {
    options = options || {}
    var el = resolveTarget(hash)
    if (!el) return false
    var $el = $(el)
    var external = $el.attr('data-class-fallback')
    if (external) {
      if (!window.DocNavigation || !window.DocNavigation.visit(external)) window.location.href = external
      return true
    }
    if (options.history) {
      if ((!window.DocNavigation || !window.DocNavigation.pushHash(hash)) && window.location.hash !== hash) {
        try { window.history.pushState(null, '', hash) } catch (e) { window.location.hash = hash }
      }
    }
    pendingHash = $el.attr('data-class-state') === 'pending' ? hash : null
    var top = Math.max(0, Math.ceil($el.offset().top - headerOffset()))
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (options.instant || reduced) {
      $('html, body').stop(true)
      window.scrollTo(0, top)
    } else {
      $('html, body').stop(true).animate({ scrollTop: top }, 250)
    }
    invalidate()
    return true
  }

  function updateToc() {
    frame = 0
    var $list = $('.site-toc-list'), $panel = $('.site-toc')
    if (!$list.length || !$panel.length || !$panel.is(':visible')) return
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop
    if (dirty) {
      positions = []
      items.forEach(function (item) {
        var el = resolveTarget('#' + item.anchorId)
        if (!el || !$(el).is(':visible')) return
        positions.push({ id: item.anchorId, top: el.getBoundingClientRect().top + scrollTop })
      })
      dirty = false
    }
    var current = positions.length ? positions[0].id : null
    positions.forEach(function (position) { if (position.top <= scrollTop + 150) current = position.id })
    if (current === active) return
    active = current
    $list.find('a.active').removeClass('active')
    var $link = $list.find('a').filter(function () { return $(this).attr('data-target') === current }).first().addClass('active')
    var box = $list.closest('.site-toc-inner')[0]
    if ($link.length && box) {
      var bounds = box.getBoundingClientRect(), link = $link[0].getBoundingClientRect()
      if (link.top < bounds.top + 40 || link.bottom > bounds.bottom - 40) {
        box.scrollTop = Math.max(0, box.scrollTop + link.top - bounds.top - (box.clientHeight - link.height) / 2)
      }
    }
  }

  function schedule() { if (!frame) frame = requestFrame(updateToc) }
  function invalidate() { dirty = true; schedule() }
  function setToc(nextItems) { items = nextItems; active = null; invalidate() }

  function detachPage() {
    if (articleObserver) articleObserver.disconnect()
    if (frame) (window.cancelAnimationFrame || window.clearTimeout)(frame)
    frame = 0
    items = []; positions = []; active = null; pendingHash = null; dirty = true

    // 切换到新页：取消旧页尚未完成与尚未开始的类预览请求。
    // 注意三点，否则会留下悬挂状态：
    // 1) 已登记在 classRequests 的 Deferred 必须显式 reject，
    //    否则后续相同 URL 会直接复用这个永不完成的 promise；
    // 2) abort 会同步触发 always 回调从 classXhrs 中 splice 自己，
    //    正向遍历会跳过下一项，因此先取出快照再倒序取消；
    // 3) 计数在新页开始时重置，避免旧请求完成时把新页计数减成负数。
    var pending = classRequests
    classRequests = Object.create(null)
    Object.keys(pending).forEach(function (key) {
      var d = pending[key]
      if (d && d.reject) { try { d.reject() } catch (e) {} }
    })
    classQueue.length = 0
    var snapshot = classXhrs.slice()
    classXhrs.length = 0
    classActive = 0
    for (var i = snapshot.length - 1; i >= 0; i--) {
      try { if (snapshot[i] && snapshot[i].abort) snapshot[i].abort() } catch (e) {}
    }
  }
  function attachPage() {
    if (window.ResizeObserver) {
      if (!articleObserver) articleObserver = new window.ResizeObserver(invalidate)
      articleObserver.disconnect()
      var article = document.querySelector('.site-main .article')
      if (article) articleObserver.observe(article)
    }
    invalidate()
  }

  function initNavigation() {
    if (initialized) return
    initialized = true
    $(document).on('click.docAnchors', 'a[href]', function (e) {
      if (e.docPageHandled || !plainClick(e) || this.target || this.hasAttribute('download') || $(this).closest('.ifm-lightbox').length) return
      var base = new URL(window.DocNavigation ? window.DocNavigation.currentUrl() : window.location.href)
      var target = new URL(this.getAttribute('href'), base)
      if (target.origin !== base.origin || target.pathname !== base.pathname || target.search !== base.search) return
      var hash = target.hash
      if (hash && resolveTarget(hash)) { e.preventDefault(); navigate(hash, { history: true }) }
    })
    $(window).on('hashchange.docNavigation popstate.docNavigation', function () {
      if (window.DocNavigation && window.DocNavigation.handleHistory()) return
      navigate(window.location.hash, { instant: true })
    })
    $(window).on('scroll.docRuntime', schedule).on('resize.docRuntime load.docRuntime', invalidate)
    $(document).on('classInlineDocReady.docRuntime', function (e) {
      invalidate()
      if (pendingHash && window.location.hash === pendingHash && resolveTarget(pendingHash) === e.target) navigate(pendingHash, { instant: true })
    }).on('input.docLayout click.docLayout', '.ifm-member-tools', invalidate)
    document.addEventListener('wheel', function () { pendingHash = null }, { passive: true })
    document.addEventListener('touchstart', function () { pendingHash = null }, { passive: true })
    document.addEventListener('pointerdown', function () { pendingHash = null }, { passive: true })
    document.addEventListener('keydown', function (e) {
      if ([32, 33, 34, 35, 36, 37, 38, 39, 40].indexOf(e.keyCode) >= 0) pendingHash = null
    })
    document.addEventListener('load', invalidate, true)
    attachPage()
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(invalidate)
    requestFrame(function () { navigate(window.location.hash, { instant: true }); invalidate() })
  }

  function loadSearchIndex() {
    if (typeof window.search_data !== 'undefined') return $.Deferred().resolve().promise()
    if (searchRequest) return searchRequest.promise()
    var deferred = searchRequest = $.Deferred(), script = document.createElement('script')
    script.src = window.DocSearchIndexUrl
    script.async = true
    script.onload = function () {
      if (typeof window.search_data !== 'undefined') deferred.resolve()
      else { searchRequest = null; deferred.reject() }
    }
    script.onerror = function () { searchRequest = null; script.remove(); deferred.reject() }
    document.head.appendChild(script)
    return deferred.promise()
  }

  window.DocRuntime = {
    materializeBranch: materializeBranch,
    materializeFor: materializeFor,
    navigate: navigate, resolveTarget: resolveTarget, plainClick: plainClick,
    setToc: setToc, invalidate: invalidate, schedule: schedule,
    initNavigation: initNavigation, loadSearchIndex: loadSearchIndex,
    detachPage: detachPage, attachPage: attachPage, cancelPendingAnchor: function () { pendingHash = null },
    fetchClassHtml: fetchClassHtml, rebaseLinks: rebaseLinks
  }
})(window, document, jQuery)

/* 同语种 API 页面局部导航：保留外壳，只替换正文和目录。 */
;(function (window, document, $) {
  'use strict'
  var mountPage = null, root = null, rootPathname = '', mountedUrl = '', currentEntry = null
  var entrySequence = 0, navigationSequence = 0, controller = null, pendingUrl = ''
  var entryPositions = Object.create(null), progressTimer = null, loadingText = ''
  // 点击瞬间的侧栏高亮快照，失败回退时用于还原
  var highlightSnapshot = null
  // 协议绝对地址（http:、https:、//cdn... ）无需再做相对解析
  var ABSOLUTE_URL = /^(?:[a-z][a-z0-9+.\-]*:|\/\/)/i
  var SKIP_URL = /^(?:data:|javascript:|mailto:|tel:)/i
  var LINK_ATTRS = ['href', 'src', 'data-class-href']
  // mousedown 预取：把网络等待挪到用户松手之前
  var prefetchCache = Object.create(null)
  var prefetchPending = Object.create(null)
  // 预取并发上限：悬停会连续触发多个预取，若不限制会瓜分带宽，
  // 导致真正点击的页面反而排在队列后变慢
  var prefetchAborts = Object.create(null)
  var prefetchQueue = []
  var prefetchActive = 0
  var PREFETCH_CONCURRENCY = 2
  var PREFETCH_QUEUE_MAX = 2
  var prefetchBound = false
  var PREFETCH_TTL = 60000
  // 缓存按总字节预算管理：正文包单页约 30~40 KB，按条数限制既可能超预算
  // 又可能留不住常用页，改以字节与 LRU 淘汰
  var PREFETCH_BUDGET = 12 * 1024 * 1024
  var PREFETCH_MAX_ITEMS = 400
  var prefetchBytes = 0

  function pageKey(url) { return url.pathname + url.search }
  // 站内绝对路径（/Components/...）不能直接交给 new URL(href, base)：
  // file:// 下会落到文件系统根，子目录部署下会丢部署前缀。
  // 统一先经 resolveDocPath 还原成完整地址，其余形态沿用原有相对解析。
  function toDocUrl(href) {
    var raw = String(href == null ? '' : href)
    if (/^\/Components\//i.test(raw) && typeof resolveDocPath === 'function') {
      return new URL(resolveDocPath(raw))
    }
    // 相对链接必须按「实际地址」解析：入口页的 mountedUrl 是文档身份
    // （指向 Components/...），用它作基准会把链接拼成重复目录。
    return new URL(raw, window.location.href)
  }

  function canVisit(href) {
    if (!root || !mountPage) return false
    var url = toDocUrl(href)
    // file:// 下 origin 都是 "null"，只能比较协议与路径前缀；
    // 本地也不带查询参数，因此不做 search 限制。
    if (url.protocol !== root.protocol) return false
    if (url.pathname.indexOf(root.pathname + 'Components/') !== 0) return false
    if (!/\.html$/i.test(url.pathname)) return false
    if (url.protocol === 'file:') return true
    return url.origin === root.origin && !url.search
  }
  function currentUrl() { return mountedUrl || window.location.href }
  function fallback(url) {
    if (window.location.href === url.href) window.location.reload()
    else window.location.href = url.href
  }
  function freezeLinks($scope, base) {
    $scope.find('[href], [src], [data-class-href]').each(function () {
      var node = this
      for (var i = 0; i < LINK_ATTRS.length; i++) {
        var attr = LINK_ATTRS[i]
        var value = node.getAttribute(attr)
        if (value === null || value === '' || value.charAt(0) === '#') continue
        // 已经是绝对地址的直接跳过：一次跳转里正文可能有上千个链接，
        // 其中大量是 https 外链，逐个 new URL() 是纯浪费
        if (ABSOLUTE_URL.test(value) || SKIP_URL.test(value)) continue
        // 站内绝对路径（/Components/...）不能直接 new URL(value, base)：
        // file:// 下会落到文件系统根，子目录部署下会丢部署前缀
        if (/^\/Components\//i.test(value)) {
          node.setAttribute(attr, resolveDocPath(value))
          continue
        }
        node.setAttribute(attr, new URL(value, base).href)
      }
    })
  }
  function restoreHashLinks() {
    $('[data-doc-local-href]').each(function () {
      $(this).attr('href', $(this).attr('data-doc-local-href')).removeAttr('data-doc-local-href')
    })
  }
  function holdHashLinks() {
    // popstate已更新地址，但旧正文仍显示；新标签页也必须指向实际正文所属页面。
    if (pageKey(new URL(mountedUrl)) === pageKey(new URL(window.location.href))) return
    $('.site-main a[href^="#"], .site-toc a[href^="#"]').each(function () {
      var href = this.getAttribute('href')
      $(this).attr('data-doc-local-href', href).attr('href', new URL(href, mountedUrl).href)
    })
  }
  function normalizeShell() {
    // 生成器未闭合的内联格式标签可能重建到TOC外层，不能让首个页面的字体/flex宽度残留。
    function lift(selector, parent) {
      var $node = $(selector).first(), $parent = $(parent).first()
      if (!$node.length || !$parent.length || $node.parent()[0] === $parent[0]) return
      var $wrappers = $node.parentsUntil($parent)
      $node.detach().appendTo($parent)
      $wrappers.each(function () {
        if (!this.children.length && !$.trim(this.textContent)) $(this).remove()
      })
      // 页脚旧格式壳可能还装着脚本；等解析完成后原位展开，保留节点而不执行脚本。
      $(function () {
        $wrappers.each(function () {
          if (!this.parentNode || !/^(B|I|EM|STRONG|CODE|FONT)$/.test(this.nodeName)) return
          while (this.firstChild) this.parentNode.insertBefore(this.firstChild, this)
          this.parentNode.removeChild(this)
        })
      })
    }
    lift('.site-toc', '#documentation-page > .container')
    lift('#search-modal', '#documentation-page')
    lift('.site-footer', 'body')
  }
  function savePosition() {
    if (!currentEntry) return
    entryPositions[currentEntry] = { x: window.pageXOffset, y: window.pageYOffset, sidebar: $('.site-sidebar').scrollTop() || 0 }
  }
  function newEntry(url, replace) {
    var state = $.extend({}, replace ? window.history.state : null)
    state.docPageEntry = Date.now() + ':' + (++entrySequence)
    // 离线不能跨文件 pushState，用同文件的 ?doc= 承载文档身份
    var address = String(url)
    if (new URL(address, window.location.href).protocol === 'file:') address = fileDocUrl(address)
    window.history[replace ? 'replaceState' : 'pushState'](state, '', address)
    currentEntry = state.docPageEntry
  }
  function readEntry() {
    var state = window.history.state
    if (state && state.docPageEntry) currentEntry = state.docPageEntry
    else newEntry(window.location.href, true)
  }
  function clearProgress() {
    clearTimeout(progressTimer)
    progressTimer = null
    $('.doc-page-progress').remove()
    $('.site-main').removeAttr('aria-busy')
  }
  function cancel() {
    navigationSequence++
    if (controller) controller.abort()
    controller = null
    pendingUrl = ''
    restoreHashLinks()
    clearProgress()
  }
  function updateSidebar(url) {
    // 目标可能在尚未物化的分支里：按需取出子菜单后再继续高亮。
    // 不能只判断「目标链接是否存在」—— 顶层链接始终存在，被裁掉的只是它的
    // 子菜单，那样会出现「分支标记为展开却没有子项」的状态。
    if (window.DocRuntime && window.DocRuntime.materializeFor) {
      var wantedPath = '/' + url.pathname.replace(/^.*?\/Components\//, 'Components/')
      var $hit = $('.site-sidebar .nav a[data-doc-path="' + wantedPath + '"]').first()
      var needsMaterialize = !$hit.length
      if (!needsMaterialize) {
        var $hitDd = $hit.closest('dd')
        if ($hitDd.attr('data-branch') && !$hitDd.children('ul.sub-menu').length) {
          needsMaterialize = true
        }
      }
      if (needsMaterialize) window.DocRuntime.materializeFor(wantedPath)
    }
    var $links = $('.site-sidebar .nav a[data-doc-path]')
    // 先收起所有分支，再按目标路径重新展开。
    // 原逻辑只清除叶子项的 active，展开状态会逐次累积：
    // 每切换一次就多一个展开分支，菜单持续变长、下方条目跟着位移，
    // 视觉上就是切换时的闪动。
    $('.site-sidebar .sub-toggle').removeClass('active')
    $links.removeAttr('aria-current').not('.sub-toggle').removeClass('active')
    var target = url.pathname
    var $current = $links.filter(function () {
      var docPath = this.getAttribute('data-doc-path')
      if (!docPath) return false
      // data-doc-path 是站点内绝对路径（/Components/...），补上部署前缀后直接字符串比较。
      // 侧栏可达数百项，每次跳转都对每项 new URL() 开销明显，且这段在初次加载时也会执行。
      return rootPathname + docPath === target
    }).first()
    $current.addClass('active').attr('aria-current', 'page')
    $current.parents('.sub-menu').each(function () { $(this).siblings('.sub-toggle').addClass('active') })
  }
  // 点击瞬间就把目标项切为选中态：等 fetch + 重建完成再更新，
  // 用户会觉得"点了没反应"，这是局部导航最明显的迟滞来源
  function highlightClicked(link) {
    var $link = $(link)
    var $nav = $('.site-sidebar .nav')
    if (!$nav.length || !$link.closest('.site-sidebar .nav').length) return
    highlightSnapshot = {
      $active: $nav.find('a.active'),
      $current: $nav.find('a[aria-current]')
    }
    $nav.find('a').not('.sub-toggle').removeClass('active')
    $nav.find('a').removeAttr('aria-current')
    $link.addClass('active').attr('aria-current', 'page')
    $link.parents('.sub-menu').each(function () { $(this).siblings('.sub-toggle').addClass('active') })
  }
  function rollbackHighlight() {
    if (!highlightSnapshot) return
    var snapshot = highlightSnapshot
    highlightSnapshot = null
    var $nav = $('.site-sidebar .nav')
    $nav.find('a').not('.sub-toggle').removeClass('active')
    $nav.find('a').removeAttr('aria-current')
    snapshot.$active.addClass('active')
    if (snapshot.$current.length) snapshot.$current.attr('aria-current', 'page')
  }
  // ---------- 预取：按下鼠标即开始拉取目标页 ----------
  // 用户从 mousedown 到 mouseup 通常有 80~150ms，这段时间足够发起并部分完成请求，
  // 真正触发 visit 时数据往往已在路上或已缓存，感知延迟明显下降。
  function prunePrefetch() {
    var keys = Object.keys(prefetchCache)
    if (!keys.length) return
    // LRU：最久未命中者先淘汰，直到满足字节预算与条数上限
    keys.sort(function (a, b) { return prefetchCache[a].at - prefetchCache[b].at })
    while (keys.length && (prefetchBytes > PREFETCH_BUDGET || keys.length > PREFETCH_MAX_ITEMS)) {
      var k = keys.shift()
      var item = prefetchCache[k]
      if (item) prefetchBytes -= item.size || 0
      delete prefetchCache[k]
    }
  }

  function dropPrefetch(key) {
    var item = prefetchCache[key]
    if (!item) return
    prefetchBytes -= item.size || 0
    delete prefetchCache[key]
  }

  // 统一的页面缓存写入：先计入新条目，再按预算/条数淘汰，
  // 保证预算与条数上限是真实上限（原实现先 prune 再写入，会短暂越界）
  function cachePut(key, html, title) {
    dropPrefetch(key)
    var item = { html: html, title: title || '', at: Date.now(), size: html.length }
    prefetchCache[key] = item
    prefetchBytes += item.size
    prunePrefetch()
  }

  // 命中：过期则丢弃重取；未过期则更新访问时间供 LRU 淘汰参考
  function cacheGet(key) {
    var item = prefetchCache[key]
    if (!item) return null
    if (Date.now() - item.at > PREFETCH_TTL) { dropPrefetch(key); return null }
    item.at = Date.now()
    return item
  }
  function runPrefetch(key) {
    var title = ''
    var ctrl = window.AbortController ? new window.AbortController() : null
    if (ctrl) prefetchAborts[key] = ctrl
    prefetchActive++
    // 预取与点击使用同一数据源（优先轻量正文包），保证缓存可直接复用
    prefetchPending[key] = requestPage(key, ctrl ? ctrl.signal : undefined)
      .then(function (result) {
        var html = result && result.html
        if (!html || !html.replace(/\s+/g, '')) throw new Error('prefetch empty')
        title = (result && result.title) || ''
        return html
      })
      .then(function (html) {
        cachePut(key, html, title)
        return html
      })
      .catch(function () { return null })
      .then(function (html) {
        delete prefetchPending[key]
        delete prefetchAborts[key]
        prefetchActive--
        drainPrefetchQueue()
        return html
      })
  }

  function drainPrefetchQueue() {
    while (prefetchActive < PREFETCH_CONCURRENCY && prefetchQueue.length) {
      var key = prefetchQueue.shift()
      if (prefetchPending[key] || cacheGet(key)) continue
      runPrefetch(key)
    }
  }

  function prefetch(href) {
    if (!href || !window.fetch || !canVisit(href)) return
    // 前台导航进行中：不启动新的后台预取，把带宽完整留给本次跳转
    if (pendingUrl) return
    var url = new URL(href, mountedUrl || window.location.href)
    url.hash = ''
    var key = url.href
    if (prefetchPending[key] || cacheGet(key)) return
    if (prefetchActive >= PREFETCH_CONCURRENCY) {
      if (prefetchQueue.indexOf(key) < 0) {
        if (prefetchQueue.length >= PREFETCH_QUEUE_MAX) prefetchQueue.shift()
        prefetchQueue.push(key)
      }
      return
    }
    runPrefetch(key)
  }

  // 点击某个页面时，把其余在途预取与排队项全部取消，把带宽让给真正的导航
  function abortPendingPrefetch(exceptKey) {
    prefetchQueue.length = 0
    Object.keys(prefetchAborts).forEach(function (key) {
      if (key === exceptKey) return
      var ctrl = prefetchAborts[key]
      if (ctrl) { try { ctrl.abort() } catch (e) {} }
      delete prefetchAborts[key]
      delete prefetchPending[key]
    })
  }
  // 正文包地址：与完整页同构的目录结构，仅根目录换成 _doc-data 并加 .json 后缀。
  // 保留部署前缀（如 /cn/api-reference-v5/...），子目录部署同样成立。
  // 正文数据地址。在线走 JSON（fetch），离线走经典脚本（<script src>）：
  // file:// 下 fetch 会被浏览器拒绝，但同目录脚本可以正常加载。
  function docDataKey(key) {
    try {
      var u = new URL(key)
      var i = u.pathname.indexOf('/Components/')
      if (i < 0) return null
      var prefix = u.pathname.slice(0, i)
      var rest = u.pathname.slice(i + 1)
      // file:// 的 origin 是 "null"，不能用 origin 拼回地址
      var base = u.protocol === 'file:'
        ? u.protocol + '//' + prefix
        : u.origin + prefix
      var ext = u.protocol === 'file:' ? '.js' : '.json'
      return base + '/_doc-data/' + rest + ext
    } catch (e) {
      return null
    }
  }

  // 离线：通过临时 script 标签加载数据分片并等待其注册
  function loadDocDataScript(key, dataKey) {
    return new window.Promise(function (resolve, reject) {
      var url = new URL(key)
      var at = url.pathname.indexOf('/Components/')
      var docKey = at >= 0 ? url.pathname.slice(at) : url.pathname
      var script = document.createElement('script')
      var done = false
      function cleanup() {
        if (script.parentNode) script.parentNode.removeChild(script)
      }
      script.onload = function () {
        done = true
        cleanup()
        var data = window.__DOC_DATA__ && window.__DOC_DATA__[docKey]
        if (data) resolve(data)
        else reject(new Error('正文数据缺失'))
      }
      script.onerror = function () {
        done = true
        cleanup()
        reject(new Error('正文数据加载失败'))
      }
      script.src = dataKey
      document.head.appendChild(script)
    })
  }

  // JSON 与完整 HTML 必须遵守同一版本规则；缺失版本不能绕过新外壳的检查。
  function assertShellBuild(incomingBuild) {
    var meta = document.querySelector('meta[name="doc-build"]')
    var currentBuild = meta ? (meta.getAttribute('content') || '') : ''
    var nextBuild = typeof incomingBuild === 'string' ? incomingBuild : ''
    if (currentBuild !== nextBuild) {
      var error = new Error('正文与页面版本不一致')
      error.staleShell = true
      throw error
    }
  }

  // 轻量正文包：只含正文与 TOC，不含顶部导航、左侧菜单、页脚与公共脚本
  function requestDocData(key, signal) {
    var dataKey = docDataKey(key)
    if (!dataKey) return null
    var isFile = new URL(key).protocol === 'file:'
    var loaded = isFile
      ? loadDocDataScript(key, dataKey)
      : window.fetch(dataKey, { credentials: 'same-origin', signal: signal })
        .then(function (response) {
          if (response.status !== 200) throw new Error('正文包缺失：' + response.status)
          return response.json()
        })
    return loaded
      .then(function (data) {
        if (!data || data.v !== 1 || typeof data.mainHtml !== 'string' || !data.mainHtml) {
          throw new Error('正文包内容无效')
        }
        // 页面身份校验：path 必填，且规范化后必须与本次请求的路径完全一致。
        // 正文包里的 path 是站点内部路径（不含部署前缀），而目标地址可能带
        // /cn/api-reference-v5/android-api 之类的前缀，直接比较会永远不等，
        // 因此在 /Components/ 处截断后再比。
        if (!data.path) throw new Error('正文包缺少页面标识')
        function innerPath(pathname) {
          var at = pathname.indexOf('/Components/')
          return at >= 0 ? pathname.slice(at) : pathname
        }
        var expectedPath = innerPath(new URL(key).pathname)
        var actualPath = innerPath(new URL(data.path, key).pathname)
        if (actualPath !== expectedPath) throw new Error('正文包与目标页面不一致')
        // 版本不同或一侧缺标记时，交给统一的整页升级路径处理。
        assertShellBuild(data.buildId)
        var mainClass = data.mainClass || 'site-main'
        var tocClass = data.tocClass || 'site-toc'
        var html = '<div class="' + mainClass + '">' + data.mainHtml + '</div>'
        if (data.tocHtml) html += '<div class="' + tocClass + '">' + data.tocHtml + '</div>'
        return { html: html, finalUrl: key, title: data.title || '' }
      })
  }

  function requestFullPage(key, signal) {
    return window.fetch(key, { credentials: 'same-origin', signal: signal })
      .then(function (response) {
        if ((response.status !== 200 && response.status !== 206) || !canVisit(response.url)) {
          throw new Error('文档请求失败：' + response.status)
        }
        var finalUrl = response.url
        return response.text().then(function (html) {
          if (!html || !/<\/html>\s*$/i.test(html)) throw new Error('文档内容不完整')
          // 回退得到的整页同样可能已发布新版，不能仅提取正文而保留旧外壳。
          var parsed = new window.DOMParser().parseFromString(html, 'text/html')
          var buildMeta = parsed.querySelector('meta[name="doc-build"]')
          assertShellBuild(buildMeta ? buildMeta.getAttribute('content') : '')
          return { html: html, finalUrl: finalUrl }
        })
      })
  }

  // 统一加载入口：优先正文包，缺失或损坏时回退完整 HTML（兼容旧部署）
  function requestPage(key, signal) {
    var viaData = requestDocData(key, signal)
    if (!viaData) return requestFullPage(key, signal)
    return viaData.catch(function (error) {
      // 外壳版本过期属于发布升级场景，交给上层整页跳转，不能静默混用
      if (error && (error.staleShell || error.name === 'AbortError')) throw error
      return requestFullPage(key, signal)
    })
  }
  function fetchPage(url, signal) {
    // 缓存键统一去掉 hash：缓存只保存页面本体，锚点由导航流程单独处理
    var key = url.href.split('#')[0]
    // 已缓存则直接复用；不再「命中即删除」，否则 A→B→A 无法命中
    var cached = cacheGet(key)
    if (cached) {
      return window.Promise.resolve({ html: cached.html, finalUrl: key, title: cached.title || '' })
    }
    var pending = prefetchPending[key]
    if (pending) {
      // 预取已在途中：复用它，避免同一页发两次请求
      return pending.then(function (html) {
        if (html) {
          var fresh = cacheGet(key)
          return { html: html, finalUrl: key, title: fresh ? fresh.title : '' }
        }
        return requestPage(key, signal).then(cacheAndReturn(key))
      })
    }
    return requestPage(key, signal).then(cacheAndReturn(key))
  }

  // 正式导航的结果同样进入缓存，供再次访问复用
  function cacheAndReturn(key) {
    return function (result) {
      if (result && result.html) cachePut(key, result.html, result.title)
      return result
    }
  }
  function enablePrefetch() {
    if (prefetchBound) return
    prefetchBound = true
    var hoverTimer = null
    // 悬停预取：从鼠标移入链接到真正点击通常有 200ms 以上，是最大的一段可提前量。
    // 延迟 80ms 再发：可过滤快速掠过的链接，又能在多数点击前完成请求。
    // 配合下方并发上限（同时最多 2 个），避免连续触发把带宽抢光。
    $(document).on('mouseenter.docPrefetch', '.site-sidebar .nav a[href]', function () {
      var link = this
      if (hoverTimer) clearTimeout(hoverTimer)
      hoverTimer = setTimeout(function () {
        hoverTimer = null
        prefetch(link.getAttribute('href'))
      }, 80)
    })
    $(document).on('mouseleave.docPrefetch', '.site-sidebar .nav a[href]', function () {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
    })
    // touchstart 覆盖触屏：手指按下到抬起同样有一段可用于发起请求的时间
    $(document).on('mousedown.docPrefetch touchstart.docPrefetch', '.site-sidebar .nav a[href]', function () {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null }
      prefetch(this.getAttribute('href'))
    })
  }
  function restorePosition(url, saved, sidebarTop) {
    window.requestAnimationFrame(function () {
      // 只以挂载身份判断：离线地址栏是 ?doc= 形式，与文档地址恒不相等，
      // 若同时比较 location.href 会直接返回，导致锚点定位被跳过。
      if (mountedUrl !== url.href) return
      if (saved) window.scrollTo(saved.x, saved.y)
      else if (url.hash) window.DocRuntime.navigate(url.hash, { instant: true })
      else window.scrollTo(0, 0)
      $('.site-sidebar').scrollTop(saved ? saved.sidebar : sidebarTop)
      window.DocRuntime.invalidate()
      $(document).trigger('docPageMounted')
    })
  }
  function visit(href, options) {
    options = options || {}
    if (!canVisit(href)) return false
    var url = toDocUrl(href)
    // 同一目标仍在请求中：直接忽略重复点击，避免重复 fetch + 整页重建
    if (pendingUrl === url.href) return true
    // 取消其他在途预取（保留本次目标，以便复用它已有的请求）
    abortPendingPrefetch(url.href.split('#')[0])
    cancel()
    savePosition()
    if (pageKey(url) === pageKey(new URL(mountedUrl))) {
      if (options.history === false) {
        readEntry()
        var saved = entryPositions[currentEntry]
        mountedUrl = url.href
        restorePosition(url, saved, $('.site-sidebar').scrollTop() || 0)
      } else if (url.hash) window.DocRuntime.navigate(url.hash, { history: true })
      else {
        if (window.location.href !== url.href) newEntry(url.href, false)
        mountedUrl = url.href
        window.scrollTo(0, 0)
        window.DocRuntime.invalidate()
      }
      return true
    }

    var sequence = navigationSequence
    var pageTitle = ''
    var sidebarTop = $('.site-sidebar').scrollTop() || 0
    var targetEntry = options.history === false && window.history.state && window.history.state.docPageEntry
    var savedPosition = targetEntry && entryPositions[targetEntry]
    holdHashLinks()
    window.DocRuntime.cancelPendingAnchor()
    pendingUrl = url.href
    controller = window.AbortController ? new window.AbortController() : null
    $('.site-main').attr('aria-busy', 'true')
    progressTimer = setTimeout(function () {
      if (sequence !== navigationSequence) return
      $('<div class="doc-page-progress" role="status" aria-live="polite"></div>').text(loadingText).css({
        position: 'fixed', right: 24, bottom: 24, zIndex: 2000, padding: '8px 12px',
        background: '#fff', color: '#526071', border: '1px solid #dce2ea', borderRadius: 6, pointerEvents: 'none'
      }).appendTo(document.body)
    }, 0)
    var timeout = setTimeout(function () {
      if (sequence === navigationSequence) { cancel(); fallback(url) }
    }, 12000)

    fetchPage(url, controller ? controller.signal : undefined)
      .then(function (result) {
        var finalUrl = new URL(result.finalUrl)
        finalUrl.hash = url.hash
        url = finalUrl
        pageTitle = result.title || ''
        return result.html
      })
      .then(function (html) {
        if (sequence !== navigationSequence) return
        var parsed = new window.DOMParser().parseFromString(html, 'text/html')
        var main = parsed.querySelector('.site-main'), toc = parsed.querySelector('.site-toc')
        if (!main || !toc || !main.querySelector('.article')) throw new Error('响应不是 API 文档')
        $(main).add(toc).find('script').remove()
        freezeLinks($(main), url.href)
        // 请求期间用户仍可阅读和滚动，提交时保存最新位置。
        savePosition()
        sidebarTop = $('.site-sidebar').scrollTop() || 0
        $('html, body').stop(true)
        $('.ifm-lightbox').remove()
        $(document).off('keydown.ifmLightbox classInlineDocReady.ifm')
        window.DocRuntime.detachPage()
        if (options.history === false) readEntry()
        else newEntry(url.href, false)
        // URL 先于正文挂载更新，确保原有相对链接和页面分派使用目标路径。
        var mountAddress = url.protocol === 'file:' ? fileDocUrl(url.href) : url.href
        if (window.location.href !== mountAddress) window.history.replaceState(window.history.state, '', mountAddress)
        mountedUrl = url.href
        $('.site-main').replaceWith(main)
        $('.site-toc').attr('class', toc.className).empty().append($(toc).contents())
        document.title = pageTitle || parsed.title || document.title
        updateSidebar(url)
        highlightSnapshot = null
        // 滚动复位必须与正文替换在同一帧提交。
        // 推到下一帧会出现「新正文停在旧滚动位置」的中间帧，
        // 页面从旧位置瞬间跳到顶部，视觉上就是整页闪动。
        if (savedPosition) window.scrollTo(savedPosition.x, savedPosition.y)
        else if (!url.hash) window.scrollTo(0, 0)
        $('.site-sidebar').scrollTop(sidebarTop)
        // 局部导航时把「不改变整体布局」的收尾增强延后一帧执行，
        // 让正文先完成一次绘制，用户不必等待整轮 DOM 增强才看到内容。
        // 首次加载不传参数，仍走完整同步路径（避免首屏闪烁）。
        mountPage({ deferred: true })
        window.DocRuntime.attachPage()
        restorePosition(url, savedPosition, sidebarTop)
      })
      .catch(function (error) {
        if (sequence !== navigationSequence) return
        rollbackHighlight()
        if (error && error.staleShell) {
          // 发布版本已更新：整页加载目标地址，让外壳与正文一起更新
          if (window.console) window.console.warn('站点版本已更新，整页加载')
          fallback(url)
          return
        }
        if (window.console) window.console.warn('文档局部导航回退为整页访问', error)
        fallback(url)
      })
      .then(function () {
        clearTimeout(timeout)
        if (sequence !== navigationSequence) return
        controller = null
        pendingUrl = ''
        clearProgress()
      })
    return true
  }
  function pushHash(hash) {
    if (!root) return false
    var target = new URL(mountedUrl)
    target.hash = hash
    cancel()
    savePosition()
    // 离线地址栏不是文档地址，用挂载身份判断是否需要新增历史
    var already = target.protocol === 'file:'
      ? (new URL(window.location.href).hash === hash && mountedUrl.split('#')[0] === target.href.split('#')[0])
      : (window.location.href === target.href)
    if (!already) newEntry(target.href, false)
    mountedUrl = target.href
    return true
  }
  // 离线地址：宿主文件不变，用 ?doc= 承载文档身份、#anchor 承载方法锚点。
  // file:// 下跨文件 pushState 会抛 SecurityError，同文件 query 可以正常使用。
  function fileDocUrl(key) {
    var u = new URL(key)
    var at = u.pathname.indexOf('/Components/')
    var doc = at >= 0 ? u.pathname.slice(at + 1) : ''
    // 必须以「当前实际地址」为宿主：file:// 下跨文件 replaceState 会抛 SecurityError，
    // mountedUrl 代表文档身份，可能指向另一个文件。
    var host = new URL(window.location.href)
    host.search = doc ? ('?doc=' + encodeURIComponent(doc)) : ''
    host.hash = u.hash || ''
    return host.href
  }

  // 从 ?doc= 还原真实文档地址（刷新/粘贴链接时使用）
  function resolveFileDocUrl() {
    if (window.location.protocol !== 'file:') return null
    var params = new URLSearchParams(window.location.search || '')
    var doc = params.get('doc')
    if (!doc) return null
    var host = new URL(window.location.href)
    host.search = ''
    var base = new URL(host.href.replace(/[^/]*$/, ''))
    return new URL(doc, base).href
  }

  function handleHistory() {
    if (!root) return false
    // 离线地址栏是 ?doc= 形式，需要还原成真实文档地址再比对
    var target = resolveFileDocUrl() || window.location.href
    var state = window.history.state
    if (mountedUrl === target && state && state.docPageEntry === currentEntry) {
      cancel()
      return true
    }
    if (pendingUrl === target) return true
    if (!visit(target, { history: false })) {
      cancel()
      window.location.reload()
    }
    return true
  }
  function init(initializer, text) {
    var isFile = window.location.protocol === 'file:'
    // 离线也用局部导航：file:// 下 fetch 不可用，但可以加载脚本形式的数据分片。
    // 这样正常切页不再整页重建，避免整页白帧。
    if (!isFile && !/^https?:$/.test(window.location.protocol)) return
    if (!isFile && !window.fetch) return
    if (!$('.site-sidebar .nav a[data-doc-path]').length) return
    // 离线可能停在 ?doc= 形式，先用它还原真实文档地址再推导站点根
    var effectiveUrl = resolveFileDocUrl() || window.location.href
    var effective = new URL(effectiveUrl)
    var match = effective.pathname.match(/^(.*\/)Components\//)
    if (match) {
      root = new URL(match[1], effective)
    } else {
      // 入口页（如 / 或 /index.html）不包含 /Components/：
      // 用页面声明的文档身份推断站点根，使首屏即可启用局部导航
      var docPathMeta = document.querySelector('meta[name="doc-path"]')
      if (!docPathMeta) return
      var docPathValue = docPathMeta.getAttribute('content') || ''
      var marker = docPathValue.indexOf('Components/')
      if (marker < 0) return
      root = new URL(window.location.pathname.replace(/[^/]*$/, ''), window.location.href)
    }
    // 侧栏 data-doc-path 不含部署前缀（如 /cn/api-reference-v5/android-api），
    // 预先算好前缀供 updateSidebar 做纯字符串比较
    rootPathname = root.pathname.replace(/\/$/, '')
    mountPage = initializer
    // 入口页的地址是站点根，但内容代表某个具体文档，挂载身份要用文档路径
    var declaredDoc = (document.querySelector('meta[name="doc-path"]') || {}).content || ''
    if (!match && declaredDoc) {
      mountedUrl = new URL(declaredDoc.replace(/^\//, ''), root).href
    } else if (match) {
      // 离线 ?doc= 场景：挂载身份必须是真实文档地址，而不是宿主文件地址
      mountedUrl = effectiveUrl
    } else {
      mountedUrl = window.location.href
    }
    loadingText = text
    readEntry()
    window.history.scrollRestoration = 'manual'
    window.DocSearchIndexUrl = new URL(window.DocSearchIndexUrl, window.location.href).href
    $('.site-sidebar .nav a[data-doc-path]').each(function () {
      var path = this.getAttribute('data-doc-path')
      if (!path) return
      var href = new URL(path.replace(/^\//, ''), root).href
      this.setAttribute(this.hasAttribute('data-href') ? 'data-href' : 'href', href)
    })
    normalizeShell()
    // 入口页/content 的相对链接是相对「实际访问地址」生成的，
    // 而 mountedUrl 代表文档身份（可能指向 Components/...）。
    // 两者混用会把链接拼成 Components/SDKManager/Components/...，
    // 因此这里一律用实际地址作为解析基址。
    freezeLinks($('.site-main'), window.location.href)
    updateSidebar(new URL(mountedUrl))
    $(document).on('click.docPages', '.site-sidebar .nav a[href], .site-main a[href]', function (e) {
      if (e.isDefaultPrevented() || !window.DocRuntime.plainClick(e) || this.target || this.hasAttribute('download')) return
      var href = this.getAttribute('href')
      if (!href || href.charAt(0) === '#') return
      // 先切高亮再发起请求：点击即刻有反馈，不必等重建完成
      var navigating = visit(href)
      if (navigating) {
        highlightClicked(this)
        e.docPageHandled = true
        e.preventDefault()
      }
    })
    // 预取只在首屏加载完成后再挂载，避免与首屏资源抢带宽
    if (document.readyState === 'complete') {
      window.setTimeout(enablePrefetch, 400)
    } else {
      $(window).one('load', function () { window.setTimeout(enablePrefetch, 400) })
    }
  }
  // 把站点内绝对路径（/Components/xxx.html）解析成完整地址。
  // 不能直接 new URL(docPath, 页面地址)：file:// 下会落到文件系统根，
  // 部署在子目录时也会丢掉部署前缀。这里以当前挂载页为基准，
  // 截取到 /Components/ 之前作为站点根再拼接。
  function resolveDocPath(docPath) {
    var raw = String(docPath || '')
    if (!raw) return raw
    if (ABSOLUTE_URL.test(raw)) return raw
    // 只处理站内绝对路径；相对路径交给浏览器按当前页面解析
    if (raw.charAt(0) !== '/') return raw
    try {
      var base = new URL(currentUrl(), window.location.href)
      var siteRoot = root
      if (!siteRoot) {
        var i = base.pathname.indexOf('/Components/')
        if (i >= 0) {
          siteRoot = new URL(base.pathname.slice(0, i + 1), base)
        } else {
          // file:// 不启用局部导航，但入口仍声明了文档身份。
          // 入口所在目录就是离线包根，不能退回文件系统根目录。
          var declared = document.querySelector('meta[name="doc-path"]')
          var docPath = declared ? (declared.getAttribute('content') || '') : ''
          siteRoot = /^\/?Components\//.test(docPath) ? new URL('./', base) : new URL('/', base)
        }
      }
      return new URL(raw.replace(/^\//, ''), siteRoot).href
    } catch (e) {
      return raw
    }
  }

  // 把 data-doc-path 解析成完整地址：既有菜单与按需物化出的新节点共用
  function refreshSidebarLinks($scope) {
    // 未初始化（如 file:// 打开在线产物）时无法解析部署根，
    // 直接返回：链接保持 HTML 原样，由浏览器按当前页相对解析。
    if (!root) return
    var $targets = $scope ? $scope.find('a[data-doc-path]') : $('.site-sidebar .nav a[data-doc-path]')
    if (!$scope) $targets = $('.site-sidebar .nav a[data-doc-path]')
    $targets.each(function () {
      var path = this.getAttribute('data-doc-path')
      if (!path) return
      var href = new URL(path.replace(/^\//, ''), root).href
      this.setAttribute(this.hasAttribute('data-href') ? 'data-href' : 'href', href)
    })
  }

  window.DocNavigation = { init: init, visit: visit, canVisit: canVisit, pushHash: pushHash, handleHistory: handleHistory, currentUrl: currentUrl, resolveDocPath: resolveDocPath, refreshSidebarLinks: refreshSidebarLinks }
})(window, document, jQuery)
