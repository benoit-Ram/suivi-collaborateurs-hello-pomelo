// src/utils/ui.js
// Toast, modale de confirmation, boutons, debounce

/**
 * Affiche une notification toast en bas à droite
 * @param {string} msg
 * @param {'success' | 'error'} type
 */
export function showToast(msg, type = 'success') {
  const bg = type === 'error' ? '#B91C1C' : '#05056D';
  const prefix = type === 'error' ? '✗ ' : '✓ ';
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;bottom:24px;right:24px;background:${bg};color:white;padding:12px 20px;border-radius:12px;font-size:0.85rem;font-weight:700;box-shadow:0 8px 24px rgba(5,5,109,0.3);z-index:500;transition:opacity 0.3s;`;
  t.textContent = prefix + msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
}

/**
 * Modale de confirmation (Promise-based)
 * @param {string} message
 * @returns {Promise<boolean>}
 */
export function confirmModal(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,5,109,0.4);backdrop-filter:blur(4px);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.15s ease;';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div style="background:white;border-radius:16px;padding:28px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(5,5,109,0.2);">
        <div style="font-size:0.95rem;font-weight:700;color:#05056D;margin-bottom:6px;">Confirmation</div>
        <div style="font-size:0.88rem;color:#6B6B9A;line-height:1.6;margin-bottom:20px;">${message}</div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="_confirmCancel" style="padding:9px 18px;border-radius:10px;border:1.5px solid #CFD0E5;background:white;color:#05056D;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;">Annuler</button>
          <button id="_confirmOk" style="padding:9px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#EF4444,#B91C1C);color:white;font-family:inherit;font-size:0.85rem;font-weight:700;cursor:pointer;">Confirmer</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const cleanup = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#_confirmCancel').onclick = () => cleanup(false);
    overlay.querySelector('#_confirmOk').onclick = () => cleanup(true);
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}

/**
 * Met un bouton en état de chargement (spinner)
 * @param {HTMLButtonElement} btn
 */
export function btnLoading(btn) {
  if (!btn) return;
  btn._origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.style.opacity = '0.7';
  btn.style.pointerEvents = 'none';
  btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">${btn._origHTML} <span style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:white;border-radius:50%;animation:spin 0.6s linear infinite;display:inline-block;"></span></span>`;
}

/**
 * Restaure un bouton après chargement
 * @param {HTMLButtonElement} btn
 */
export function btnDone(btn) {
  if (!btn) return;
  btn.disabled = false;
  btn.style.opacity = '';
  btn.style.pointerEvents = '';
  if (btn._origHTML) btn.innerHTML = btn._origHTML;
}

/**
 * Bascule un accordéon
 * @param {string} id — id de l'élément accordéon (préfixé "acc-")
 */
export function toggleAcc(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const pointId = id.replace('acc-', '');
  const icon = document.getElementById('acc-icon-' + pointId);
  const open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (icon) icon.textContent = open ? '▼' : '▲';
}

/**
 * Debounce une fonction
 * @param {Function} fn
 * @param {number} delay — en millisecondes
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
