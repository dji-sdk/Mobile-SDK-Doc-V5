/* 文档运行时：双站共享导航、TOC 帧调度和搜索索引加载，不包含语言文案。 */
;(function (window, document, $) {
  'use strict'
  var items = [], positions = [], dirty = true, frame = 0, active = null
  var pendingHash = null, initialized = false
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
    var el = document.getElementById(id) || document.getElementById(id.toLowerCase())
    if (el && $(el).hasClass('api-row')) {
      var inlineId = $(el).attr('data-class-inline-id') || ($(el).find('a.trigger').first().attr('href') || '').replace(/^#/, '') || el.id + '_inline'
      el = document.getElementById(inlineId) || el
    }
    if (!el) el = document.getElementById(id + '_inline')
    // 历史类级 UID 指向无 ID 的 h1，映射到 Overview；不改其他锚点大小写。
    var page = window.location.pathname.split('/').pop().replace(/\.html$/i, '').toLowerCase()
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
    if (external) { window.location.href = external; return true }
    if (options.history && window.location.hash !== hash) {
      try { window.history.pushState(null, '', hash) } catch (e) { window.location.hash = hash }
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

  function initNavigation() {
    if (initialized) return
    initialized = true
    $(document).on('click.docAnchors', 'a[href^="#"]', function (e) {
      if (!plainClick(e) || this.target || $(this).closest('.ifm-lightbox').length) return
      var hash = this.getAttribute('href')
      if (hash !== '#' && resolveTarget(hash)) { e.preventDefault(); navigate(hash, { history: true }) }
    })
    $(window).on('hashchange.docNavigation popstate.docNavigation', function () { navigate(window.location.hash, { instant: true }) })
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
    if (window.ResizeObserver) {
      var article = document.querySelector('.site-main .article')
      if (article) new window.ResizeObserver(invalidate).observe(article)
    }
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
    fetchClassHtml: fetchClassHtml, rebaseLinks: rebaseLinks
  }
})(window, document, jQuery)
