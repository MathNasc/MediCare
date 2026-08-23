'use client';
import { useEffect, useRef } from 'react';

class BackHandler {
  constructor() {
    this.stack = [];
    this.isPopping = false;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (e) => this.onPopState(e));
    }
  }

  onPopState(e) {
    if (this.isPopping) {
      this.isPopping = false;
      return;
    }
    
    // Process the stack until we find a live callback
    while (this.stack.length > 0) {
      const item = this.stack.pop();
      if (!item.dead) {
        item.callback();
        break;
      }
    }
  }

  push(id, callback) {
    this.stack.push({ id, callback, dead: false });
    window.history.pushState({ backId: id }, '');
  }

  remove(id) {
    const idx = this.stack.findIndex(item => item.id === id);
    if (idx === -1) return;
    
    if (idx === this.stack.length - 1) {
      // It is at the top of the stack, safe to silently pop the browser history
      this.stack.pop();
      this.isPopping = true;
      window.history.back();
    } else {
      // It is not at the top (e.g. unmounted out of order), mark as dead so it's ignored later
      this.stack[idx].dead = true;
    }
  }
}

let backHandlerInstance = null;
function getBackHandler() {
  if (!backHandlerInstance) backHandlerInstance = new BackHandler();
  return backHandlerInstance;
}

/**
 * Hook to intercept the hardware back button.
 * @param {boolean} isActive - Whether the interceptor is currently active (e.g. modal is open).
 * @param {function} onClose - The function to call when the hardware back button is pressed.
 */
export function useBackButton(isActive, onClose) {
  const idRef = useRef(Math.random().toString(36).substring(2, 9));
  const callbackRef = useRef(onClose);

  useEffect(() => {
    callbackRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isActive) return;
    
    const handler = getBackHandler();
    const id = idRef.current;
    handler.push(id, () => {
      if (callbackRef.current) callbackRef.current();
    });
    
    return () => {
      handler.remove(id);
    };
  }, [isActive]);
}
