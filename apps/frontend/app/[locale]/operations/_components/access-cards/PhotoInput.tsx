"use client";

import { Alert, AlertDescription, Button } from "@vms/ui";
import { Camera, ImageUp, UserRound, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
/** Photos are small; refuse anything bigger than 5 MB. */
const MAX_BYTES = 5 * 1024 * 1024;

export interface PickedPhoto {
  blob: Blob;
  previewUrl: string;
}

/**
 * The visitor's photo for the card: upload a file, or take a still with the
 * webcam (a frame drawn to a canvas and saved as JPEG). Nothing is uploaded
 * here; the parent uploads the blob when it saves.
 */
export function PhotoInput({
  value,
  onChange,
}: {
  value: PickedPhoto | null;
  onChange: (photo: PickedPhoto | null) => void;
}) {
  const t = useTranslations("operations.accessCards.photo");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
  }, [stream]);

  // Release the camera when the form closes.
  React.useEffect(
    () => () => stream?.getTracks().forEach((s) => s.stop()),
    [stream],
  );

  React.useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const pick = (blob: Blob) => {
    if (value) URL.revokeObjectURL(value.previewUrl);
    onChange({ blob, previewUrl: URL.createObjectURL(blob) });
  };

  const onFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setError(t("badType"));
    if (file.size > MAX_BYTES) return setError(t("tooBig"));
    pick(file);
  };

  const openCamera = async () => {
    setError(null);
    try {
      setStream(
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 960, height: 1280 },
        }),
      );
    } catch {
      setError(t("noCamera"));
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    // Crop the centre to the card's 4:5 photo frame.
    const h = video.videoHeight;
    const w = Math.min(video.videoWidth, Math.round((h * 4) / 5));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas
      .getContext("2d")
      ?.drawImage(video, (video.videoWidth - w) / 2, 0, w, h, 0, 0, w, h);
    canvas.toBlob(
      (blob) => {
        if (blob) pick(blob);
        stop();
      },
      "image/jpeg",
      0.9,
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert intent="danger">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-start gap-4">
        <div className="flex h-30 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label={t("live")}
              className="h-full w-full object-cover"
            />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.previewUrl}
              alt={t("preview")}
              className="h-full w-full object-cover"
            />
          ) : (
            <UserRound className="size-10 text-fg-subtle" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {stream ? (
            <>
              <Button type="button" size="sm" onClick={capture}>
                <Camera className="size-4" aria-hidden="true" />
                {t("capture")}
              </Button>
              <Button
                type="button"
                size="sm"
                intent="neutral"
                tone="outline"
                onClick={stop}
              >
                {t("cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                intent="neutral"
                tone="outline"
                onClick={() => fileRef.current?.click()}
              >
                <ImageUp className="size-4" aria-hidden="true" />
                {t("upload")}
              </Button>
              <Button
                type="button"
                size="sm"
                intent="neutral"
                tone="outline"
                onClick={() => void openCamera()}
              >
                <Camera className="size-4" aria-hidden="true" />
                {t("take")}
              </Button>
              {value ? (
                <Button
                  type="button"
                  size="sm"
                  intent="neutral"
                  tone="ghost"
                  onClick={() => {
                    URL.revokeObjectURL(value.previewUrl);
                    onChange(null);
                  }}
                >
                  <X className="size-4" aria-hidden="true" />
                  {t("remove")}
                </Button>
              ) : null}
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-label={t("upload")}
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="text-xs text-fg-muted">{t("hint")}</p>
    </div>
  );
}
