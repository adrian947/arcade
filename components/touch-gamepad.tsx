"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import type { TouchButton, TouchControls } from "@/games/types";

const REPEAT_DELAY_MS = 200;
const REPEAT_INTERVAL_MS = 70;

const DPAD: readonly { button: TouchButton; glyph: string; aria: string }[] = [
  { button: "up", glyph: "▲", aria: "ARRIBA" },
  { button: "left", glyph: "◀", aria: "IZQUIERDA" },
  { button: "right", glyph: "▶", aria: "DERECHA" },
  { button: "down", glyph: "▼", aria: "ABAJO" },
];

// Botón mantenido: tecla simulada, elemento (para el estado visual) y timers de auto-repetición.
type Held = { code: string; el: HTMLElement; timeout?: number; interval?: number };

// KeyboardEvent.key equivalente al code, para motores que lean e.key.
function keyFor(code: string): string {
  if (code === "Space") return " ";
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^(Shift|Control|Alt|Meta)(Left|Right)$/.test(code)) return code.replace(/(Left|Right)$/, "");
  return code;
}

function dispatchKey(type: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: keyFor(code), repeat, bubbles: true, cancelable: true }));
}

function release(held: Map<TouchButton, Held>, button: TouchButton) {
  const h = held.get(button);
  if (!h) return;
  window.clearTimeout(h.timeout);
  window.clearInterval(h.interval);
  h.el.classList.remove("pressed");
  held.delete(button);
  dispatchKey("keyup", h.code);
}

function releaseAll(held: Map<TouchButton, Held>) {
  for (const button of [...held.keys()]) release(held, button);
}

// Gamepad en pantalla: simula en window las teclas que el motor ya escucha.
export function TouchGamepad({ controls, disabled }: { controls: TouchControls; disabled: boolean }) {
  const heldRef = useRef(new Map<TouchButton, Held>());

  // En pausa / fin de partida no se despacha nada y se sueltan los botones mantenidos.
  useEffect(() => {
    if (disabled) releaseAll(heldRef.current);
  }, [disabled]);

  // Al desmontar: soltar todo y cancelar timers.
  useEffect(() => {
    const held = heldRef.current;
    return () => releaseAll(held);
  }, []);

  const onDown = (button: TouchButton) => (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); // sin foco ni gestos del navegador
    const held = heldRef.current;
    const code = controls.keys[button];
    if (disabled || !code || held.has(button)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.classList.add("pressed");
    const h: Held = { code, el: e.currentTarget };
    held.set(button, h);
    dispatchKey("keydown", code);
    if (controls.repeat?.includes(button)) {
      h.timeout = window.setTimeout(() => {
        dispatchKey("keydown", code, true);
        h.interval = window.setInterval(() => dispatchKey("keydown", code, true), REPEAT_INTERVAL_MS);
      }, REPEAT_DELAY_MS);
    }
  };
  const onUp = (button: TouchButton) => () => release(heldRef.current, button);

  const btn = (button: TouchButton, text: string, aria: string) => (
    <button
      key={button}
      type="button"
      tabIndex={-1}
      className={"touch-btn " + button}
      aria-label={aria}
      onPointerDown={onDown(button)}
      onPointerUp={onUp(button)}
      onPointerCancel={onUp(button)}
      onLostPointerCapture={onUp(button)}
    >
      {text}
    </button>
  );

  const actions = (["b", "a"] as const).filter((b) => controls.keys[b]);

  return (
    <div className={"touch-pad" + (disabled ? " is-disabled" : "")} onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-dpad">
        {DPAD.filter((d) => controls.keys[d.button]).map((d) => btn(d.button, d.glyph, d.aria))}
      </div>
      {actions.length > 0 && (
        <div className="touch-actions">
          {actions.map((b) => {
            const label = controls.labels?.[b] ?? b.toUpperCase();
            return btn(b, label, label);
          })}
        </div>
      )}
    </div>
  );
}
