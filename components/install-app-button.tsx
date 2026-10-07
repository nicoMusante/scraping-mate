"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    const iosCheck = window.setTimeout(() => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setIsIos(ios && !window.matchMedia("(display-mode: standalone)").matches);
    }, 0);

    const registerWorker = async () => {
      if ("serviceWorker" in navigator) await navigator.serviceWorker.register("/sw.js");
    };
    void registerWorker();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => {
      window.clearTimeout(iosCheck);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    if (isIos) {
      setShowIosInstructions(true);
      return;
    }
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  };

  if (!prompt && !isIos) return null;

  return <>
    <button type="button" onClick={() => void install()} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#6d947f] px-3 text-sm font-medium transition hover:bg-[#285542]" aria-label="Instalar Mate Finder">
      <Download size={16} /><span className="hidden sm:inline">Instalar</span>
    </button>
    {showIosInstructions && <div role="dialog" aria-modal="true" aria-label="Cómo instalar Mate Finder" className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 mx-auto max-w-sm rounded-2xl border border-[#d7cbb9] bg-[#fffdf9] p-5 text-[#18271f] shadow-xl">
      <button type="button" onClick={() => setShowIosInstructions(false)} className="absolute right-3 top-3 rounded-full p-2 text-[#536158] hover:bg-[#f4efe6]" aria-label="Cerrar"><X size={18} /></button>
      <h2 className="pr-8 font-serif text-2xl">Instalar Mate Finder</h2>
      <p className="mt-2 text-sm leading-6 text-[#536158]">En Safari, tocá Compartir y elegí <strong>“Agregar a pantalla de inicio”</strong>. Se abrirá como una app, sin la barra del navegador.</p>
    </div>}
  </>;
}
