// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Admin-Verwaltung (nur SaaS-Modus, nur Rolle admin): Kontenliste mit
 * Plan-Zuweisung. Ohne Live-Bezahlung setzt hier der Betreiber die Abo-Stufen
 * von Hand. Nicht-Admins werden zum Dashboard umgeleitet.
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PLAN_LISTE } from '@campanium/shared';
import { ladeNutzerliste, setzeNutzerPlan, type AuthNutzer } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';

export function AdminSeite() {
  const { saasModus, nutzer } = useAuth();
  const { t } = useI18n();
  const [liste, setListe] = useState<AuthNutzer[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    if (!saasModus || nutzer?.rolle !== 'admin') return;
    ladeNutzerliste()
      .then(setListe)
      .catch((e: Error) => setFehler(e.message))
      .finally(() => setGeladen(true));
  }, [saasModus, nutzer?.rolle]);

  // Zugriffsschutz: nur Admins im SaaS-Modus.
  if (!saasModus || nutzer?.rolle !== 'admin') return <Navigate to="/" replace />;

  const aendern = async (id: string, plan: string) => {
    setFehler(null);
    try {
      const aktualisiert = await setzeNutzerPlan(id, plan);
      setListe((alt) => alt.map((n) => (n.id === id ? aktualisiert : n)));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Speichern fehlgeschlagen'));
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 text-2xl">{t('Verwaltung')}</h1>
      <p className="mb-5 text-sm text-text-schwach">
        {t('Konten und ihre Abo-Stufen. Änderungen greifen sofort.')}
      </p>
      {fehler && <p className="mb-3 text-sm text-rot">{fehler}</p>}

      {!geladen ? (
        <p className="text-text-schwach">{t('Lädt …')}</p>
      ) : (
        <div className="karte karte-ornament overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rand text-left text-[11px] uppercase tracking-wider text-text-schwach">
                <th className="px-4 py-2.5">{t('E-Mail')}</th>
                <th className="px-4 py-2.5">{t('Rolle')}</th>
                <th className="px-4 py-2.5">{t('Plan')}</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((n) => (
                <tr key={n.id} className="border-b border-rand/50 last:border-0">
                  <td className="px-4 py-2.5 text-text-stark">{n.email}</td>
                  <td className="px-4 py-2.5 text-text-schwach">{t(n.rolle)}</td>
                  <td className="px-4 py-2.5">
                    <select
                      className="rounded border border-rand bg-flaeche-3 px-2 py-1 text-text-stark"
                      value={n.plan}
                      onChange={(e) => void aendern(n.id, e.target.value)}
                      aria-label={t('Plan für {email}', { email: n.email })}
                    >
                      {PLAN_LISTE.map((p) => (
                        <option key={p.stufe} value={p.stufe}>
                          {t(p.name)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
