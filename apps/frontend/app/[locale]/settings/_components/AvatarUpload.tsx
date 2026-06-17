"use client";

import { Avatar, Spinner, cn } from "@vms/ui";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { useUploadAvatar } from "@/data/settings/queries";
import { useAuth } from "@/shared/auth/AuthContext";
import { avatarUrl } from "@/shared/avatarUrl";

const ACCEPT = "image/jpeg,image/png,image/webp";

/** Avatar (gold ring) + "Edit profile" → file picker → presign → S3 PUT → save. */
export function AvatarUpload() {
  const t = useTranslations("settings");
  const { user } = useAuth();
  const upload = useUploadAvatar();
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (file) upload.mutate(file);
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          "relative rounded-full ring-2 ring-accent ring-offset-2 ring-offset-surface",
          upload.isPending && "opacity-60",
        )}
      >
        <Avatar
          name={user?.fullName ?? "User"}
          src={avatarUrl(user?.avatarKey)}
          size="lg"
        />
        {upload.isPending ? (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner className="size-5" />
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50"
      >
        <Pencil className="size-4" aria-hidden="true" />
        {t("profile.editProfile")}
      </button>
      {upload.isError ? (
        <span className="text-xs text-danger">{t("profile.uploadError")}</span>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}
