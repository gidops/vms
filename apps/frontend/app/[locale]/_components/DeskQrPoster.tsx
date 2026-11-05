"use client";

import type { DeskQrView } from "@vms/contracts";
import { PrintSheet } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import styles from "./DeskQrPoster.module.css";

/** The printed walk-in QR poster for the VMC desk. */
export function DeskQrPoster({ qr, image }: { qr: DeskQrView; image: string }) {
  const t = useTranslations("deskQr.poster");
  const format = useFormatter();
  return (
    <PrintSheet>
      <div className={styles.poster}>
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/afreximbank.svg" alt="" />
          <span>{t("brand")}</span>
        </div>
        <h1>{t("title")}</h1>
        <p className={styles.sub}>{t("subtitle")}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.qr} src={image} alt="" />
        <p>{t("then")}</p>
        <p>{t("code")}</p>
        <p className={styles.langs}>English · Français · العربية</p>
        <p className={styles.foot}>
          {t("footer", {
            date: format.dateTime(new Date(qr.tokenRotatedAt), {
              dateStyle: "medium",
            }),
          })}
        </p>
      </div>
    </PrintSheet>
  );
}
