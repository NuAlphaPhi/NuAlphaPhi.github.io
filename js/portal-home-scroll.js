/* Desktop home columns scroll separately and share overflow at their edges. */
window.napHomeScroll = function (layout, feed, updates) {
  const desktop = matchMedia('(min-width: 1101px)');
  function resize() {
    if (!desktop.matches || !layout.getClientRects().length) return;
    layout.style.setProperty('--home-column-height', Math.max(240, innerHeight - layout.getBoundingClientRect().top - 16) + 'px');
  }
  [feed, updates].forEach((column, i) => {
    column.tabIndex = 0;
    column.setAttribute('aria-label', i ? 'Brotherhood updates' : 'Home feed');
  });
  function move(column, amount) {
    const before = column.scrollTop;
    column.scrollTop = Math.max(0, Math.min(column.scrollHeight - column.clientHeight, before + amount));
    return amount - (column.scrollTop - before);
  }
  layout.addEventListener('wheel', event => {
    if (!desktop.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    const column = feed.contains(event.target) ? feed : updates.contains(event.target) ? updates : null;
    if (!column) return;
    // Let text areas and other nested scrolling controls handle their own input.
    for(let el=event.target; el && el!==column; el=el.parentElement) {
      if(el.tagName==='TEXTAREA' || (el.scrollHeight>el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY))) return;
    }
    const amount = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? column.clientHeight : 1);
    let remainder = move(column, amount);
    if (Math.abs(remainder) > .5) remainder = move(column === feed ? updates : feed, remainder);
    // Keep the page shell steady, including when both columns have reached the end.
    event.preventDefault();
  }, {passive:false});
  window.addEventListener('resize', resize);
  document.addEventListener('nap:tab-changed', () => requestAnimationFrame(resize));
  new ResizeObserver(resize).observe(layout.parentElement);
  requestAnimationFrame(resize);
};
