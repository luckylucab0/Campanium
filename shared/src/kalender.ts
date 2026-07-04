// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Rechen- und Formatierungshilfen für den Kampagnen-Kalender.
 * Der Kalender kennt keine Wochen: Monate haben nur Namen und Längen,
 * Tage werden bei +/− sauber über Monats- und Jahresgrenzen gerollt.
 */
import type { Kalender, KalenderDatum } from './types';

/** Ist der Kalender eingerichtet (mindestens ein Monat)? */
export function kalenderAktiv(kalender: Kalender): boolean {
  return kalender.monate.length > 0;
}

/**
 * Zieht ein Datum in den gültigen Bereich des Kalenders (Monat und Tag
 * werden auf existierende Werte begrenzt) – z. B. nachdem der DM die
 * Monatsliste verkürzt hat.
 */
export function klemmeDatum(kalender: Kalender, datum: KalenderDatum): KalenderDatum {
  if (!kalenderAktiv(kalender)) return datum;
  const monat = Math.min(Math.max(1, datum.monat), kalender.monate.length);
  const tage = kalender.monate[monat - 1]!.tage;
  return { jahr: datum.jahr, monat, tag: Math.min(Math.max(1, datum.tag), tage) };
}

/** Der Tag danach – rollt über Monats- und Jahresgrenzen. */
export function naechsterTag(kalender: Kalender, datum: KalenderDatum): KalenderDatum {
  const d = klemmeDatum(kalender, datum);
  if (d.tag < kalender.monate[d.monat - 1]!.tage) return { ...d, tag: d.tag + 1 };
  if (d.monat < kalender.monate.length) return { jahr: d.jahr, monat: d.monat + 1, tag: 1 };
  return { jahr: d.jahr + 1, monat: 1, tag: 1 };
}

/** Der Tag davor – rollt über Monats- und Jahresgrenzen. */
export function vorherigerTag(kalender: Kalender, datum: KalenderDatum): KalenderDatum {
  const d = klemmeDatum(kalender, datum);
  if (d.tag > 1) return { ...d, tag: d.tag - 1 };
  if (d.monat > 1) {
    const monat = d.monat - 1;
    return { jahr: d.jahr, monat, tag: kalender.monate[monat - 1]!.tage };
  }
  const monat = kalender.monate.length;
  return { jahr: d.jahr - 1, monat, tag: kalender.monate[monat - 1]!.tage };
}

/** Formatiert ein Datum, z. B. „12. Mondwende 735 BC“. */
export function formatKalenderDatum(kalender: Kalender, datum: KalenderDatum): string {
  const monat = kalender.monate[datum.monat - 1]?.name ?? `Monat ${datum.monat}`;
  const aera = kalender.aera ? ` ${kalender.aera}` : '';
  return `${datum.tag}. ${monat} ${datum.jahr}${aera}`;
}

/** Sind zwei Kalenderdaten derselbe Tag? */
export function gleichesDatum(a: KalenderDatum, b: KalenderDatum): boolean {
  return a.jahr === b.jahr && a.monat === b.monat && a.tag === b.tag;
}

/** Vorlage: 12 gleich lange Monate à 30 Tage (schnellster Start). */
export function vorlageZwoelfMonate(): Kalender['monate'] {
  return Array.from({ length: 12 }, (_, i) => ({ name: `${i + 1}. Monat`, tage: 30 }));
}

/** Vorlage: irdischer Kalender (ohne Schaltjahre). */
export function vorlageIrdisch(): Kalender['monate'] {
  const namen = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];
  const laengen = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return namen.map((name, i) => ({ name, tage: laengen[i]! }));
}
