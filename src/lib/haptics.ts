/**
 * Cross-platform haptic feedback engine supporting:
 * 1. Android & standards via Navigator Vibration API
 * 2. iOS Safari & WebKit PWAs via native switch Taptic Engine triggering
 */

let iosHapticLabel: HTMLLabelElement | null = null;
let iosHapticInput: HTMLInputElement | null = null;

function ensureIosHapticElements() {
  if (typeof document === 'undefined') return;
  if (!iosHapticLabel || !document.body.contains(iosHapticLabel)) {
    iosHapticLabel = document.createElement('label');
    iosHapticLabel.htmlFor = 'homebase-global-haptic-switch';
    iosHapticLabel.setAttribute('aria-hidden', 'true');
    Object.assign(iosHapticLabel.style, {
      position: 'fixed',
      opacity: '0',
      pointerEvents: 'none',
      width: '1px',
      height: '1px',
      top: '-9999px',
      left: '-9999px',
      zIndex: '-9999',
    });

    iosHapticInput = document.createElement('input');
    iosHapticInput.id = 'homebase-global-haptic-switch';
    iosHapticInput.type = 'checkbox';
    iosHapticInput.setAttribute('switch', '');
    iosHapticInput.setAttribute('aria-hidden', 'true');
    iosHapticInput.tabIndex = -1;

    iosHapticLabel.appendChild(iosHapticInput);
    document.body.appendChild(iosHapticLabel);
  }
}

/**
 * Trigger universal haptic feedback
 * @param pattern vibration duration in ms or pattern array for Android; triggers Taptic engine tick on iOS
 */
export function triggerHaptic(pattern: number | number[] = 18) {
  // 1. Android / standard browsers
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {}
  }

  // 2. iOS Safari & WebKit PWAs
  try {
    ensureIosHapticElements();
    if (iosHapticLabel) {
      iosHapticLabel.click();
    }
  } catch {}
}

/**
 * Attaches a transparent native switch to an element so touching it with a finger
 * immediately fires hardware Taptic feedback on iOS.
 */
export function attachIosHapticTouch(el: HTMLElement | null) {
  if (!el || typeof document === 'undefined') return;
  // Check if already attached
  if (el.querySelector('input[data-ios-haptic-touch]')) return;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.setAttribute('data-ios-haptic-touch', 'true');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  Object.assign(input.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    margin: '0',
    opacity: '0',
    pointerEvents: 'none', // Allow pointer events to reach the handle
    clipPath: 'inset(0 round 999px)',
  });
  el.style.position = 'relative';
  el.appendChild(input);
}
