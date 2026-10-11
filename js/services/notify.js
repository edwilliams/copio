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
  if (!customElements.get('sl-alert')) {
    await customElements.whenDefined('sl-alert');
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
      stack.style.top = '0';
      stack.style.insetInlineEnd = '0';
      stack.style.maxHeight = '100%';
      stack.style.maxWidth = '100%';
      stack.style.overflow = 'auto';
    } else {
      stack.style.position = '';
      stack.style.top = '';
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
    clear,
    setContainer,
    getContainer,
  },
);

export default notify;
