"use client";

import { useEffect, useState } from "react";
import type { PublicModel } from "@/lib/ai/types";

export interface ImageModelInfo {
  id: string;
  label: string;
  providerLabel: string;
  available: boolean;
  aspectRatios: string[];
  qualities: string[];
  unitUsd: number;
}

export interface VideoModelInfo {
  id: string;
  label: string;
  providerLabel: string;
  available: boolean;
  durations: number[];
  resolutions: string[];
  textToVideo: boolean;
  imageToVideo: boolean;
  unitUsdPerSecond: number;
}

interface Catalogue {
  chat: PublicModel[];
  image: ImageModelInfo[];
  video: VideoModelInfo[];
}

let cache: Promise<Catalogue> | null = null;

export function useModels() {
  const [data, setData] = useState<Catalogue | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    cache ??= fetch("/api/models").then((r) => {
      if (!r.ok) throw new Error("Could not load models");
      return r.json();
    });
    cache.then(setData).catch((e) => {
      cache = null;
      setError(e.message);
    });
  }, []);
  return { models: data, error };
}
