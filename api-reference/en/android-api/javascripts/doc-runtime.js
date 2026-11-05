/* 文档运行时：双站共享导航、TOC 帧调度和搜索索引加载，不包含语言文案。 */
;(function (window, document, $) {
  'use strict'
  var items = [], positions = [], dirty = true, frame = 0, active = null
  var pendingHash = null, initialized = false, articleObserver = null
  var requestFrame = window.requestAnimationFrame || function (fn) { return setTimeout(fn, 16) }
  var searchRequest = null
  var classRequests = Object.create(null), classQueue = [], classActive = 0

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
        $.ajax({ url: job.key, dataType: 'html', cache: true, timeout: 12000 })
          .done(function (html) { job.deferred.resolve(html) })
          .fail(function () { delete classRequests[job.key]; job.deferred.reject() })
          .always(function () { classActive--; pumpClasses() })
      })(job)
    }
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
  var mountPage = null, root = null, mountedUrl = '', currentEntry = null
  var entrySequence = 0, navigationSequence = 0, controller = null, pendingUrl = ''
  var entryPositions = Object.create(null), progressTimer = null, loadingText = ''

  function pageKey(url) { return url.pathname + url.search }
  function canVisit(href) {
    if (!root || !mountPage) return false
    var url = new URL(href, mountedUrl || window.location.href)
    return url.origin === root.origin && url.pathname.indexOf(root.pathname + 'Components/') === 0 && /\.html$/i.test(url.pathname) && !url.search
  }
  function currentUrl() { return mountedUrl || window.location.href }
  function fallback(url) {
    if (window.location.href === url.href) window.location.reload()
    else window.location.href = url.href
  }
  function freezeLinks($scope, base) {
    $scope.find('[href], [src], [data-class-href]').each(function () {
      var node = this
      ;['href', 'src', 'data-class-href'].forEach(function (attr) {
        var value = node.getAttribute(attr)
        if (value === null || /^(#|data:|javascript:|mailto:|tel:)/i.test(value)) return
        node.setAttribute(attr, new URL(value, base).href)
      })
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
    window.history[replace ? 'replaceState' : 'pushState'](state, '', url)
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
    var $links = $('.site-sidebar .nav a[data-doc-path]')
    $links.removeAttr('aria-current').not('.sub-toggle').removeClass('active')
    var $current = $links.filter(function () {
      var href = this.getAttribute('data-href') || this.getAttribute('href')
      return href && new URL(href, root).pathname === url.pathname
    }).first()
    $current.addClass('active').attr('aria-current', 'page')
    $current.parents('.sub-menu').each(function () { $(this).siblings('.sub-toggle').addClass('active') })
  }
  function restorePosition(url, saved, sidebarTop) {
    window.requestAnimationFrame(function () {
      if (window.location.href !== url.href || mountedUrl !== url.href) return
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
    var url = new URL(href, mountedUrl || window.location.href)
    if (options.history === false && pendingUrl === url.href) return true
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
    }, 150)
    var timeout = setTimeout(function () {
      if (sequence === navigationSequence) { cancel(); fallback(url) }
    }, 12000)

    window.fetch(url.href, { credentials: 'same-origin', signal: controller ? controller.signal : undefined })
      .then(function (response) {
        if (!response.ok || !canVisit(response.url)) throw new Error('文档请求失败：' + response.status)
        var finalUrl = new URL(response.url)
        finalUrl.hash = url.hash
        url = finalUrl
        return response.text()
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
        if (window.location.href !== url.href) window.history.replaceState(window.history.state, '', url.href)
        mountedUrl = url.href
        $('.site-main').replaceWith(main)
        $('.site-toc').attr('class', toc.className).empty().append($(toc).contents())
        document.title = parsed.title || document.title
        updateSidebar(url)
        $('.site-sidebar').scrollTop(sidebarTop)
        mountPage()
        window.DocRuntime.attachPage()
        restorePosition(url, savedPosition, sidebarTop)
      })
      .catch(function (error) {
        if (sequence !== navigationSequence) return
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
    if (window.location.href !== target.href) newEntry(target.href, false)
    mountedUrl = target.href
    return true
  }
  function handleHistory() {
    if (!root) return false
    var state = window.history.state
    if (mountedUrl === window.location.href && state && state.docPageEntry === currentEntry) {
      cancel()
      return true
    }
    if (pendingUrl === window.location.href) return true
    if (!visit(window.location.href, { history: false })) {
      cancel()
      window.location.reload()
    }
    return true
  }
  function init(initializer, text) {
    if (!/^https?:$/.test(window.location.protocol) || !window.fetch || !$('.site-sidebar .nav a[data-doc-path]').length) return
    var match = window.location.pathname.match(/^(.*\/)Components\//)
    if (!match) return
    root = new URL(match[1], window.location.href)
    mountPage = initializer
    mountedUrl = window.location.href
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
    freezeLinks($('.site-main'), mountedUrl)
    updateSidebar(new URL(mountedUrl))
    $(document).on('click.docPages', '.site-sidebar .nav a[href], .site-main a[href]', function (e) {
      if (e.isDefaultPrevented() || !window.DocRuntime.plainClick(e) || this.target || this.hasAttribute('download')) return
      var href = this.getAttribute('href')
      if (!href || href.charAt(0) === '#') return
      if (visit(href)) { e.docPageHandled = true; e.preventDefault() }
    })
  }
  window.DocNavigation = { init: init, visit: visit, canVisit: canVisit, pushHash: pushHash, handleHistory: handleHistory, currentUrl: currentUrl }
})(window, document, jQuery)
