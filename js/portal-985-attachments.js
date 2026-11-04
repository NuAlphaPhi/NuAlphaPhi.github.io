/* Clipboard and file-picker photos share the same pending attachment. */
(function () {
  const P = window.P985;
  P.photoAttachment = (form, picker, holder, busy) => {
    let selected = null, url = null;
    function clear() {
      selected = null;
      picker.value = '';
      holder.replaceChildren();
      if (url) URL.revokeObjectURL(url);
      url = null;
    }
    function choose(file) {
      if (busy() || !file || !file.type.startsWith('image/')) return;
      clear();
      selected = file;
      url = URL.createObjectURL(file);
      const thumb = P.button('', () => {
        const image = P.el('img', 'p-pasted-photo-full');
        image.src = url;
        image.alt = 'Attached photo preview';
        P.dialog('Photo preview', image);
      }, 'p-pasted-photo');
      thumb.setAttribute('aria-label', 'Expand attached photo');
      const image = P.el('img');
      image.src = url;
      image.alt = 'Photo ready to send';
      thumb.append(image);
      const remove = P.button('×', () => { if (!busy()) clear(); }, 'p-pasted-photo-remove');
      remove.setAttribute('aria-label', 'Remove attached photo');
      holder.append(thumb, remove);
    }
    picker.onchange = () => choose(picker.files[0]);
    form.addEventListener('paste', event => {
      const items = Array.from(event.clipboardData?.items || []);
      const item = items.find(item => item.kind === 'file' && item.type.startsWith('image/'));
      const file = item?.getAsFile() || Array.from(event.clipboardData?.files || []).find(file => file.type.startsWith('image/'));
      if (!file) return; // Preserve normal text and link pasting.
      event.preventDefault();
      choose(file);
    });
    return {get file() { return selected; }, clear};
  };
})();
