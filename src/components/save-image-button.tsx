"use client";

import { toCanvas } from "html-to-image";
import { CameraIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { cnCopy } from "@/lib/i18n/cn";

export function SaveImageButton({ userId }: { userId: string }) {
  const [state, setState] = useState<"idle" | "capturing" | "success" | "error">("idle");
  const shareFilesSupportRef = useRef<boolean | null>(null);
  const localeCopy = cnCopy;

  const waitForDomSettled = async () => {
    // Let pending state updates and layout flush before capture.
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))),
    );
  };

  const canvasToBlob = async (canvas: HTMLCanvasElement) => {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.9);
    });

    if (!blob) {
      throw new Error("Failed to encode image blob");
    }

    return blob;
  };

  // Check if device supports sharing files via Web Share API
  const checkShareFilesSupport = async (): Promise<boolean> => {
    if (shareFilesSupportRef.current !== null) {
      return shareFilesSupportRef.current;
    }

    if (!navigator.share) return false;

    // iOS Safari 15+ and Android Chrome support files
    // Create a small test file to verify
    try {
      const testBlob = new Blob(["test"], { type: "text/plain" });
      const testFile = new File([testBlob], "test.txt", { type: "text/plain" });

      // navigator.canShare is available on devices that support file sharing
      if ("canShare" in navigator) {
        const canShare = navigator.canShare?.({ files: [testFile] }) ?? false;
        shareFilesSupportRef.current = canShare;
        return canShare;
      }

      // Fallback: assume files are supported if navigator.share exists
      // (this is the case for most modern iOS and Android)
      shareFilesSupportRef.current = true;
      return true;
    } catch (err) {
      console.warn("Error checking share support:", err);
      shareFilesSupportRef.current = false;
      return false;
    }
  };

  const getExportPixelRatio = () => {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(Math.max(dpr, 1), 2);
  };

  const handleCapture = async () => {
    const captureTarget = document.getElementById("export-capture");

    if (!captureTarget) {
      console.error("Export capture target not found");
      setState("error");
      setTimeout(() => setState("idle"), 2000);
      return;
    }

    setState("capturing");

    try {
      await waitForDomSettled();

      const htmlTheme = document.documentElement.dataset.theme;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = htmlTheme === "dark" || (htmlTheme !== "light" && prefersDark);

      const fallbackBackgroundColor = isDark ? "#0b0b10" : "#f7f8fb";
      const bodyBackgroundColor = window.getComputedStyle(document.body).backgroundColor;
      const rootBackgroundColor = window.getComputedStyle(document.documentElement).backgroundColor;
      const backgroundColor = [bodyBackgroundColor, rootBackgroundColor].find(
        (color) => color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)",
      ) ?? fallbackBackgroundColor;

      const hiddenForExport = Array.from(
        captureTarget.querySelectorAll<HTMLElement>("[data-export-hidden]"),
      );
      const originalDisplays = hiddenForExport.map((element) => element.style.display);

      for (const element of hiddenForExport) {
        element.style.display = "none";
      }

      const exportCheckboxes = Array.from(
        captureTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      const rootStyle = window.getComputedStyle(document.documentElement);
      const accentColor = rootStyle.getPropertyValue("--accent").trim() || "#e76f51";
      const panelStrongColor = rootStyle.getPropertyValue("--panel-strong").trim() || "#fffdf9";
      const checkboxRestoreState = exportCheckboxes.map((checkbox) => ({
        checkbox,
        display: checkbox.style.display,
        marker: null as HTMLSpanElement | null,
      }));

      for (const entry of checkboxRestoreState) {
        const { checkbox } = entry;
        const computed = window.getComputedStyle(checkbox);
        const rect = checkbox.getBoundingClientRect();
        const size = rect.width > 0 ? `${rect.width}px` : computed.width || "1rem";
        const borderRadius = computed.borderRadius && computed.borderRadius !== "0px" ? computed.borderRadius : "0.2rem";
        const uncheckedBorderColor =
          computed.borderColor && computed.borderColor !== "rgba(0, 0, 0, 0)"
            ? computed.borderColor
            : "#d1d5db";

        const marker = document.createElement("span");
        marker.setAttribute("aria-hidden", "true");
        marker.style.display = "inline-flex";
        marker.style.alignItems = "center";
        marker.style.justifyContent = "center";
        marker.style.width = size;
        marker.style.height = size;
        marker.style.boxSizing = "border-box";
        marker.style.border = `1px solid ${uncheckedBorderColor}`;
        marker.style.borderRadius = borderRadius;
        marker.style.background = panelStrongColor;
        marker.style.lineHeight = "1";
        marker.style.flexShrink = "0";

        if (checkbox.checked) {
          marker.style.borderColor = accentColor;
          marker.style.background = accentColor;
          marker.innerHTML =
            "<svg viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M3.5 8.5 6.5 11.5 12.5 4.5\" stroke=\"white\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";
        }

        checkbox.insertAdjacentElement("beforebegin", marker);
        checkbox.style.display = "none";
        entry.marker = marker;
      }

      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

      const exportPixelRatio = getExportPixelRatio();
      let screenshotCanvas: HTMLCanvasElement;
      try {
        screenshotCanvas = await toCanvas(captureTarget, {
          pixelRatio: exportPixelRatio,
          backgroundColor,
        });
      } finally {
        for (const entry of checkboxRestoreState) {
          entry.checkbox.style.display = entry.display;
          entry.marker?.remove();
        }
        hiddenForExport.forEach((element, index) => {
          element.style.display = originalDisplays[index] ?? "";
        });
      }

      const padding = 36;
      const canvas = document.createElement("canvas");
      canvas.width = screenshotCanvas.width + padding * 2;
      canvas.height = screenshotCanvas.height + padding * 2;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Canvas context not available");
      }

      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(screenshotCanvas, padding, padding);

      const finalBlob = await canvasToBlob(canvas);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `bdrsongs-${userId}-${dateStr}.webp`;

      // On mobile devices, prefer Web Share API for better UX
      // On desktop, always download directly
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        try {
          // Check if the device supports sharing files
          // On iOS, we need to check if files are actually supported
          const supportsShareFiles = await checkShareFilesSupport();
          
          if (supportsShareFiles) {
            const file = new File([finalBlob], filename, { type: "image/webp" });

            await navigator.share({
              files: [file],
            });

            setState("success");
            setTimeout(() => setState("idle"), 2000);
            return;
          }
        } catch (err) {
          // Check if it's a user cancellation (AbortError is expected)
          if (err instanceof DOMException && err.name === "AbortError") {
            console.log("User cancelled share");
          } else {
            console.warn("Web Share API failed:", err);
          }
        }
      }

      // Fallback: download directly
      const link = document.createElement("a");
      link.download = filename;
      const downloadUrl = URL.createObjectURL(finalBlob);
      link.href = downloadUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error("Failed to capture image:", err);
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };

  return (
    <div className="flex justify-center pb-2">
      <button
        type="button"
        disabled={state === "capturing"}
        onClick={handleCapture}
        className="inline-flex items-center gap-2 rounded-full border border-border-soft bg-panel-strong px-5 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-accent hover:bg-accent/5 disabled:opacity-50"
      >
        {state === "capturing" ? (
          <Loader2Icon className="h-4 w-4 animate-spin text-accent" />
        ) : state === "success" ? (
          <CheckIcon className="h-4 w-4 text-green-500" />
        ) : (
          <CameraIcon className="h-4 w-4 text-accent" />
        )}
        {state === "capturing"
          ? localeCopy.saveImageButtonCapturing
          : state === "success"
            ? localeCopy.saveImageButtonSuccess
            : localeCopy.saveImageButtonIdle}
      </button>
    </div>
  );
}
