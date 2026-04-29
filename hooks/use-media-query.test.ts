// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMediaQuery } from "./use-media-query";

type ChangeListener = (e: MediaQueryListEvent) => void;

function setupMatchMedia(initialMatches: boolean) {
  const listeners = new Set<ChangeListener>();
  const mql = {
    matches: initialMatches,
    media: "",
    onchange: null,
    addEventListener: vi.fn((_: string, l: ChangeListener) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: ChangeListener) => listeners.delete(l)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => {
      mql.media = query;
      return mql;
    }),
  });
  return {
    mql,
    fire: (matches: boolean) => {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches } as MediaQueryListEvent));
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useMediaQuery", () => {
  it("returns the initial matches value from matchMedia", () => {
    setupMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023.98px)"));
    expect(result.current).toBe(true);
  });

  it("subscribes to change events and updates state when the query result flips", () => {
    const { fire } = setupMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 1023.98px)"));
    expect(result.current).toBe(false);

    act(() => fire(true));
    expect(result.current).toBe(true);

    act(() => fire(false));
    expect(result.current).toBe(false);
  });

  it("removes the change listener on unmount", () => {
    const { mql } = setupMatchMedia(true);
    const { unmount } = renderHook(() => useMediaQuery("(max-width: 1023.98px)"));
    expect(mql.addEventListener).toHaveBeenCalledOnce();
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledOnce();
  });
});
