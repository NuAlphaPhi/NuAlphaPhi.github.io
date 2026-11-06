/* Shared phone presentation. Keep stored numbers intact; default legacy numbers to +1. */
(function () {
  'use strict';
  function national(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
    return digits;
  }
  function us(digits) {
    if (!digits) return '';
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
  }
  function format(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = national(raw);
    if ((!raw.startsWith('+') || raw.startsWith('+1')) && digits.length === 10)
      return '+1 ' + us(digits);
    // Preserve explicit international numbers and incomplete legacy values.
    return raw;
  }
  function canonical(value, code) {
    const raw = String(value || '').trim();
    if (!/^\+[1-9]\d{0,2}$/.test(code) || !/^[+\d\s().-]+$/.test(raw)) return '';
    const digits = raw.replace(/\D/g, '');
    const result = raw.startsWith('+') ? '+' + digits : code + (code === '+1' ? national(raw) : digits);
    if (!/^\+[1-9]\d{6,14}$/.test(result)) return '';
    if (result.startsWith('+1') && result.length !== 12) return '';
    return result;
  }
  window.napPhone = { format, canonical, national, us };
  document.addEventListener?.('input', function(event) {
    const field=event.target;
    if(field?.type!=='tel'||field.id==='portal-signup-phone')return;
    const raw=field.value;
    if(/^\+(?!1)/.test(raw))return;
    const explicit=/^\+1/.test(raw);
    const digits=explicit?raw.slice(2).replace(/\D/g,''):national(raw);
    if(digits.length>10)return;
    const count=Math.max(0,raw.slice(0,field.selectionStart).replace(/\D/g,'').length-(explicit?1:0));
    field.value=digits?'+1 '+us(digits):'';
    let pos=3,seen=0;while(pos<field.value.length&&seen<count){if(/\d/.test(field.value[pos]))seen++;pos++;}
    field.setSelectionRange(Math.min(pos,field.value.length),Math.min(pos,field.value.length));
  });
  document.addEventListener?.('blur', function(event) {
    const field=event.target;
    if(field?.type==='tel' && field.id!=='portal-signup-phone') field.value=format(field.value);
  }, true);
  const input = document.getElementById('portal-signup-phone');
  const country = document.getElementById('portal-signup-country');
  if (!input || !country) return;
  function update() {
    if (country.value !== '+1' || /^\+(?!1)/.test(input.value)) return;
    const before = input.value;
    const caret = input.selectionStart;
    let count = before.slice(0, caret).replace(/\D/g, '').length;
    const digits = national(before);
    if (digits.length > 10) return; // Validation reports excess digits instead of silently truncating.
    if (before.replace(/\D/g, '').length === 11) count = Math.max(0, count - 1);
    input.value = us(digits);
    let position = 0, seen = 0;
    while (position < input.value.length && seen < count) {
      if (/\d/.test(input.value[position])) seen++;
      position++;
    }
    input.setSelectionRange(position, position);
  }
  input.addEventListener('input', update);
  country.addEventListener('change', function () {
    input.placeholder = country.value === '+1' ? '123-123-1234' : 'Phone number';
    update();
  });
  input.placeholder = '123-123-1234';
})();
