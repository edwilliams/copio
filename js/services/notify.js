/**
 * Unified toast & notification service (CPO-022)
 * Wraps Shoelace sl-alert.toast() with success, error, warning, info, and undo variants.
 * Supports container scoping for SDK mode and constrained layouts.
 */

let activeContainer = null;

const VARIANT_CONFIG = {
  success: {
    slVariant: 'success',
    defaultIcon: 'check-circle',
    defaultDuration: 3000,
  },
  error: {
    slVariant: 'danger',
    defaultIcon: 'exclamation-octagon',
    defaultDuration: 5000,
  },
  danger: {
    slVariant: 'danger',
    defaultIcon: 'exclamation-octagon',
    defaultDuration: 5000,
  },
  warning: {
    slVariant: 'warning',
    defaultIcon: 'exclamation-triangle',
    defaultDuration: 4000,
  },
  info: {
    slVariant: 'primary',
    defaultIcon: 'info-circle',
    defaultDuration: 4000,
  },
  primary: {
    slVariant: 'primary',
    defaultIcon: 'info-circle',
    defaultDuration: 4000,
  },
  neutral: {
    slVariant: 'neutral',
    defaultIcon: 'info-circle',
    defaultDuration: 4000,
  },
};

/**
 * Configure target container where toast stacks should render.
 * @param {HTMLElement|null} container - null resets to document.body
 */
export function setContainer(container) {
  activeContainer = container || null;
}

/**
 * Get the currently configured toast container.
 * @returns {HTMLElement}
 */
export function getContainer() {
  return activeContainer || (typeof document !== 'undefined' ? document.body : null);
}

/**
 * Dismiss all currently active toasts.
 */
export function clear() {
  const SlAlert = customElements.get('sl-alert');
  const stack = SlAlert?.toastStack;
  if (stack) {
    const alerts = stack.querySelectorAll('sl-alert');
    alerts.forEach((alert) => {
      if (typeof alert.hide === 'function') {
        alert.hide();
      }
    });
  }
}

/**
 * Display a unified toast notification.
 * @param {string|Object} messageOrOptions
 * @param {Object} [options]
 * @returns {Promise<HTMLElement>} The created <sl-alert> element
 */
export async function show(messageOrOptions, options = {}) {
  let opts = {};
  if (typeof messageOrOptions === 'string' || messageOrOptions instanceof HTMLElement) {
    opts = { message: messageOrOptions, ...options };
  } else if (messageOrOptions && typeof messageOrOptions === 'object') {
    opts = { ...messageOrOptions, ...options };
  }

  // Ensure Shoelace sl-alert is defined
  if (typeof customElements !== 'undefined' && !customElements.get('sl-alert')) {
    await Promise.race([
      customElements.whenDefined('sl-alert'),
      new Promise((r) => setTimeout(r, 200)),
    ]);
  }

  if (typeof customElements === 'undefined' || !customElements.get('sl-alert')) {
    return null;
  }

  const SlAlert = customElements.get('sl-alert');
  const rawVariant = opts.variant || 'info';
  const config = VARIANT_CONFIG[rawVariant] || VARIANT_CONFIG.info;

  const targetContainer = opts.container || getContainer();

  // Scope toastStack to the target container (crucial for SDK / constrained container mode)
  if (SlAlert?.toastStack && targetContainer) {
    const stack = SlAlert.toastStack;
    if (stack.parentElement !== targetContainer) {
      targetContainer.appendChild(stack);
    }

    if (targetContainer !== document.body) {
      stack.style.position = 'absolute';
      stack.style.width = 'auto';
      stack.style.maxWidth = 'calc(100% - 24px)';
      stack.style.left = '12px';
      stack.style.right = '12px';
      stack.style.insetInlineStart = '12px';
      stack.style.insetInlineEnd = '12px';
      if (opts.position === 'top') {
        stack.style.top = '12px';
        stack.style.bottom = 'auto';
      } else {
        stack.style.top = 'auto';
        stack.style.bottom = '16px';
      }
      stack.style.maxHeight = '100%';
      stack.style.overflow = 'auto';
    } else {
      stack.style.position = '';
      stack.style.width = '';
      stack.style.left = '';
      stack.style.right = '';
      stack.style.top = '';
      stack.style.bottom = '';
      stack.style.insetInlineStart = '';
      stack.style.insetInlineEnd = '';
      stack.style.maxHeight = '';
      stack.style.maxWidth = '';
      stack.style.overflow = '';
    }
  }

  const alert = document.createElement('sl-alert');
  alert.variant = config.slVariant;
  alert.closable = opts.closable !== false;
  alert.duration = opts.duration !== undefined ? opts.duration : config.defaultDuration;

  // Add icon slot if requested
  const iconName = opts.icon !== undefined ? opts.icon : config.defaultIcon;
  if (iconName) {
    const icon = document.createElement('sl-icon');
    icon.slot = 'icon';
    icon.name = iconName;
    alert.appendChild(icon);
  }

  // Build content & optional action button
  const messageNode = document.createElement('span');
  if (opts.message instanceof HTMLElement) {
    messageNode.appendChild(opts.message);
  } else if (opts.html) {
    messageNode.innerHTML = opts.message || '';
  } else {
    messageNode.textContent = opts.message || '';
  }

  if (opts.action) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'space-between';
    wrapper.style.gap = '0.75rem';
    wrapper.style.width = '100%';

    messageNode.style.flex = '1';
    wrapper.appendChild(messageNode);

    const actionBtn = document.createElement('sl-button');
    actionBtn.size = 'small';
    actionBtn.variant = opts.action.variant || 'text';
    actionBtn.textContent = opts.action.text || 'Action';
    actionBtn.style.color = 'inherit';
    actionBtn.style.fontWeight = '600';
    actionBtn.style.padding = '0';

    actionBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof opts.action.onClick === 'function') {
        opts.action.onClick(e, alert);
      }
      if (opts.action.autoClose !== false) {
        alert.hide();
      }
    });

    wrapper.appendChild(actionBtn);
    alert.appendChild(wrapper);
  } else {
    alert.appendChild(messageNode);
  }

  // Trigger toast and capture hide promise
  const toastPromise = alert.toast();
  alert.toastPromise = toastPromise;

  return alert;
}

/**
 * Display a success notification.
 */
export function success(message, options = {}) {
  return notify.show({ message, variant: 'success', ...options });
}

/**
 * Display an error notification.
 */
export function error(message, options = {}) {
  return notify.show({ message, variant: 'error', ...options });
}

/**
 * Display a warning notification.
 */
export function warning(message, options = {}) {
  return notify.show({ message, variant: 'warning', ...options });
}

/**
 * Display an informational notification.
 */
export function info(message, options = {}) {
  return notify.show({ message, variant: 'info', ...options });
}

/**
 * Display an undoable notification.
 * @param {string} message
 * @param {Function} onUndo - Callback invoked when the user clicks Undo
 * @param {Object} [options]
 */
export function undo(message, onUndo, options = {}) {
  return notify.show({
    message,
    variant: options?.variant || 'primary',
    icon: options?.icon !== undefined ? options.icon : 'arrow-counterclockwise',
    duration: options?.duration !== undefined ? options.duration : 5000,
    closable: options?.closable !== false,
    action: {
      text: options?.actionText || 'Undo',
      onClick: (e, alert) => {
        if (typeof onUndo === 'function') {
          onUndo(e, alert);
        }
      },
      autoClose: true,
    },
    ...options,
  });
}

/**
 * Display a progress toast notification with a determinate or indeterminate progress bar.
 * @param {string|Object} messageOrOptions
 * @param {Object} [options]
 * @returns {Promise<{ alert: HTMLElement, progressBar: HTMLElement, update: (opts: { done?: number, total?: number, value?: number, message?: string }) => void, close: () => void }>}
 */
export async function progress(messageOrOptions, options = {}) {
  let opts = {};
  if (typeof messageOrOptions === 'string') {
    opts = { message: messageOrOptions, ...options };
  } else if (messageOrOptions && typeof messageOrOptions === 'object') {
    opts = { ...messageOrOptions, ...options };
  }

  if (typeof customElements !== 'undefined') {
    if (!customElements.get('sl-alert') || !customElements.get('sl-progress-bar')) {
      await Promise.race([
        Promise.all([
          customElements.whenDefined('sl-alert'),
          customElements.whenDefined('sl-progress-bar'),
        ]),
        new Promise((r) => setTimeout(r, 200)),
      ]);
    }
  }

  if (typeof customElements === 'undefined' || !customElements.get('sl-alert')) {
    return {
      alert: null,
      progressBar: null,
      update() {},
      close() {},
    };
  }

  const container = opts.container || getContainer();

  const alert = document.createElement('sl-alert');
  alert.variant = opts.variant || 'primary';
  alert.closable = opts.closable === true;
  alert.duration = Infinity;

  const iconName = opts.icon !== undefined ? opts.icon : 'arrow-down-circle';
  if (iconName) {
    const icon = document.createElement('sl-icon');
    icon.slot = 'icon';
    icon.name = iconName;
    alert.appendChild(icon);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'notify-progress-wrapper';
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '0.35rem';
  wrapper.style.minWidth = '220px';

  const labelRow = document.createElement('div');
  labelRow.style.display = 'flex';
  labelRow.style.justifyContent = 'space-between';
  labelRow.style.alignItems = 'center';
  labelRow.style.gap = '0.5rem';

  const messageNode = document.createElement('span');
  messageNode.className = 'notify-progress-message';
  messageNode.style.fontWeight = '500';
  messageNode.style.fontSize = '0.9rem';
  messageNode.textContent = opts.message || 'Processing...';
  labelRow.appendChild(messageNode);

  const statusNode = document.createElement('span');
  statusNode.className = 'notify-progress-status';
  statusNode.style.fontSize = '0.78rem';
  statusNode.style.color = '#64748b';
  statusNode.style.fontWeight = '600';
  const initialDone = opts.done !== undefined ? opts.done : 0;
  const initialTotal = opts.total !== undefined ? opts.total : 0;
  if (initialTotal > 0) {
    statusNode.textContent = `${initialDone} / ${initialTotal}`;
  } else if (opts.value !== undefined) {
    statusNode.textContent = `${opts.value}%`;
  }
  labelRow.appendChild(statusNode);
  wrapper.appendChild(labelRow);

  const progressBar = document.createElement('sl-progress-bar');
  if (initialTotal > 0) {
    progressBar.value = Math.round((initialDone / initialTotal) * 100);
  } else if (opts.value !== undefined) {
    progressBar.value = opts.value;
  } else {
    progressBar.indeterminate = true;
  }
  wrapper.appendChild(progressBar);

  alert.appendChild(wrapper);

  // Scope toastStack
  const SlAlert = customElements.get('sl-alert');
  if (SlAlert?.toastStack && container) {
    const stack = SlAlert.toastStack;
    if (stack.parentElement !== container) {
      container.appendChild(stack);
    }
  }

  alert.toast();

  const handle = {
    alert,
    progressBar,
    /**
     * @param {Object} [updates]
     * @param {number} [updates.done]
     * @param {number} [updates.total]
     * @param {number} [updates.value]
     * @param {string} [updates.message]
     */
    update({ done, total, value, message } = {}) {
      if (message !== undefined) {
        messageNode.textContent = message;
      }
      if (total !== undefined && done !== undefined) {
        progressBar.indeterminate = false;
        const pct = Math.min(100, Math.max(0, Math.round((done / Math.max(total, 1)) * 100)));
        progressBar.value = pct;
        statusNode.textContent = `${done} / ${total}`;
      } else if (value !== undefined) {
        progressBar.indeterminate = false;
        progressBar.value = Math.min(100, Math.max(0, value));
        statusNode.textContent = `${Math.round(progressBar.value)}%`;
      }
    },
    close() {
      if (typeof alert.hide === 'function') {
        alert.hide();
      }
    },
  };

  return handle;
}

/**
 * Main notify interface.
 */
export const notify = Object.assign(
  function (messageOrOptions, options) {
    return show(messageOrOptions, options);
  },
  {
    show,
    success,
    error,
    warning,
    info,
    undo,
    progress,
    clear,
    setContainer,
    getContainer,
  },
);

export default notify;
