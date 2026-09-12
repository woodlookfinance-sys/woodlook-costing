/* WOODLOOK — modal.js: minimal reusable modal dialog */
const Modal = (() => {
  function close() {
    const root = document.getElementById('modalRoot');
    root.innerHTML = '';
  }

  function open({ title, body, footer, large, onMount }) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop">
        <div class="modal ${large ? 'modal-lg' : ''}" role="dialog" aria-modal="true">
          <div class="modal-head"><h3>${title}</h3><button class="modal-close" id="modalCloseX">&times;</button></div>
          <div class="modal-body">${body}</div>
          ${footer ? `<div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">${footer}</div>` : ''}
        </div>
      </div>`;
    const modalEl = root.querySelector('.modal');
    root.querySelector('#modalCloseX').onclick = close;
    root.querySelector('#modalBackdrop').addEventListener('click', (e) => {
      if (e.target.id === 'modalBackdrop') close();
    });
    if (onMount) onMount(modalEl);
    return modalEl;
  }

  return { open, close };
})();
