import { createContext, useCallback, useContext } from 'react';

/** Registry of DOM drop targets so a dragged card can hit-test where it was released. */
export type ZoneRegistry = Map<string, HTMLElement>;

export const DropZoneContext = createContext<ZoneRegistry>(new Map());

export const PLAY_ZONE = '__play__';

export function useDropZone(id: string) {
  const registry = useContext(DropZoneContext);
  return useCallback(
    (el: HTMLElement | null) => {
      if (el) registry.set(id, el);
      else registry.delete(id);
    },
    [registry, id],
  );
}

/** Returns the zone under a client-space point. Specific targets win over the general play area. */
export function zoneAt(registry: ZoneRegistry, x: number, y: number): string | null {
  let fallback: string | null = null;
  for (const [id, el] of registry) {
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      if (id === PLAY_ZONE) fallback = id;
      else return id;
    }
  }
  return fallback;
}
