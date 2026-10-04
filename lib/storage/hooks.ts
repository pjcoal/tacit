"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, getSettings, saveSettings, subscribe, type Settings } from "./db";

/** Load a value from IndexedDB and reload it whenever its topic changes. */
export function useLive<T>(topic: Parameters<typeof subscribe>[0], load: () => Promise<T>, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const reload = useCallback(() => {
    load()
      .then((v) => {
        setValue(v);
        setReady(true);
      })
      .catch(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    reload();
    return subscribe(topic, reload);
  }, [topic, reload]);
  return { value, ready, reload };
}

export function useSettings() {
  const { value, ready } = useLive("settings", getSettings, DEFAULT_SETTINGS);
  const update = useCallback(
    async (patch: Partial<Settings>) => {
      await saveSettings({ ...(await getSettings()), ...patch });
    },
    [],
  );
  return { settings: value, ready, update };
}
