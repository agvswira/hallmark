import { useEffect, useSyncExternalStore, type ReactNode } from "react";

// ---------------------------------------------------------------- routing

const subscribe = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
export const usePath = () => useSyncExternalStore(subscribe, () => window.location.pathname);

export function navigate(to: string) {
  if (to === window.location.pathname) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}

/** An internal link that keeps normal link behaviour (new tab, copy link) and routes in-app. */
export function Link({ to, children, ...rest }: { to: string; children: ReactNode } & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={to}
      {...rest}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------- small pieces

export const short = (hex?: string, n = 6) => (hex ? `${hex.slice(0, n + 2)}…${hex.slice(-4)}` : "");
export const explorer = (kind: "address" | "tx", value: string) => `https://explore.qore.network/${kind}/${value}`;

export function Spinner({ label }: { label: string }) {
  return (
    <div className="busy" role="status">
      <progress className="loading-spinner" aria-label={label} />
      <span>{label}</span>
    </div>
  );
}

export function MatchTag({ match, current = true }: { match: "full" | "partial" | "none"; current?: boolean }) {
  if (!current) return <span className="tag changed">Code changed since verified</span>;
  const text = { full: "Full match", partial: "Partial match", none: "No match" }[match];
  return <span className={`tag ${match}`}>{text}</span>;
}

export function PqTag({ flags }: { flags: number }) {
  if (!flags) return <span className="hint">None detected</span>;
  const names = [flags & 1 ? "pqcVerify" : "", flags & 2 ? "pqcKeyStatus" : ""].filter(Boolean).join(" + ");
  return <span className="tag pq">PQ-guarded: {names}</span>;
}

// ---------------------------------------------------------------- copy button

/**
 * A copy button declared with Invoker Commands (command="--copy", commandfor=target id).
 * The bubble next to the button is the visible feedback and the live region.
 */
export function CopyButton({ target, label }: { target: string; label: string }) {
  return (
    <span className="copy">
      <button type="button" className="copy-button" {...({ command: "--copy", commandfor: target } as object)} aria-label={label}>
        Copy
      </button>
      <span className="tip" role="status" />
    </span>
  );
}

const timers = new WeakMap<Element, number>();
let lastMessage = "";

function report(button: Element, ok: boolean) {
  const tip = button.nextElementSibling;
  if (!tip) return;
  window.clearTimeout(timers.get(button));
  button.removeAttribute("data-copied");
  button.removeAttribute("data-failed");
  tip.textContent = "";
  let message = ok ? "Copied" : "Copy failed";
  if (message === lastMessage) message += " "; // VoiceOver skips an identical repeat
  lastMessage = message;
  button.setAttribute(ok ? "data-copied" : "data-failed", "");
  requestAnimationFrame(() => (tip.textContent = message));
  timers.set(
    button,
    window.setTimeout(() => {
      button.removeAttribute("data-copied");
      button.removeAttribute("data-failed");
      tip.textContent = "";
    }, 2000),
  );
}

async function copy(button: Element, target: Element) {
  const text = target.matches("input, textarea") ? (target as HTMLInputElement).value : (target as HTMLElement).innerText.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    report(button, true);
  } catch {
    report(button, false);
  }
}

/** Registers one page-wide handler: native command events, or a click fallback. */
export function useCopyCommands() {
  useEffect(() => {
    if ("CommandEvent" in window) {
      const onCommand = (e: Event) => {
        const ev = e as Event & { command: string; source: Element };
        if (ev.command === "--copy" && e.target instanceof Element) copy(ev.source, e.target);
      };
      document.addEventListener("command", onCommand, true);
      return () => document.removeEventListener("command", onCommand, true);
    }
    const onClick = (e: MouseEvent) => {
      const button = (e.target as Element).closest?.('button[command="--copy"]');
      if (!button) return;
      const target = document.getElementById(button.getAttribute("commandfor") ?? "");
      if (target) copy(button, target);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

// ---------------------------------------------------------------- form errors

/**
 * Keeps aria-invalid and aria-describedby in step with :user-invalid, so screen readers get
 * the error only after interaction, as sighted users do. Each field names its error element
 * in data-error.
 */
export function useUserInvalidAria(form: React.RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    const root = form.current;
    if (!root) return;
    const supported = CSS.supports("selector(:user-invalid)");
    const sync = (el: EventTarget | null) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
      const invalid = supported ? el.matches(":user-invalid") : !el.validity.valid;
      el.setAttribute("aria-invalid", invalid ? "true" : "false");
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== errorId);
      if (invalid) ids.push(errorId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
      if (!supported) document.getElementById(errorId)?.classList.toggle("shown", invalid);
    };
    root.querySelectorAll("input, select").forEach((el) => el.setAttribute("aria-invalid", "false"));
    const onBlur = (e: Event) => sync(e.target);
    const onInput = (e: Event) => (e.target as Element).getAttribute("aria-invalid") === "true" && sync(e.target);
    const onInvalid = (e: Event) => sync(e.target);
    root.addEventListener("blur", onBlur, true);
    root.addEventListener("input", onInput);
    root.addEventListener("change", onBlur, true);
    root.addEventListener("invalid", onInvalid, true);
    return () => {
      root.removeEventListener("blur", onBlur, true);
      root.removeEventListener("input", onInput);
      root.removeEventListener("change", onBlur, true);
      root.removeEventListener("invalid", onInvalid, true);
    };
  }, [form]);
}
