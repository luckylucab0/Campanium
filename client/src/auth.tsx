// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Auth-Kontext für den SaaS-Modus.
 *
 * Beim Start klärt der Provider über /api/config, ob der Server im SaaS-Modus
 * läuft. Nur dann besteht Login-Pflicht; in der Self-Host-Variante ist
 * `saasModus` false und die App startet wie bisher ohne Konto.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as api from './api';
import type { AuthNutzer } from './api';

interface AuthWert {
  /** Läuft der Server im SaaS-Modus (Login-Pflicht)? */
  saasModus: boolean;
  /** Angemeldetes Konto oder null. */
  nutzer: AuthNutzer | null;
  /** Bootstrap (config + me) läuft noch. */
  laden: boolean;
  anmelden: (email: string, passwort: string) => Promise<void>;
  registrieren: (email: string, passwort: string) => Promise<void>;
  abmelden: () => Promise<void>;
}

const AuthContext = createContext<AuthWert | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [saasModus, setSaasModus] = useState(false);
  const [nutzer, setNutzer] = useState<AuthNutzer | null>(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const konfig = await api.ladeAppKonfig();
      if (abgebrochen) return;
      setSaasModus(konfig.saas);
      if (konfig.saas) {
        const mich = await api.ladeMich();
        if (!abgebrochen) setNutzer(mich);
      }
      if (!abgebrochen) setLaden(false);
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  const anmelden = useCallback(async (email: string, passwort: string) => {
    setNutzer(await api.meldeAn(email, passwort));
  }, []);

  const registrieren = useCallback(async (email: string, passwort: string) => {
    setNutzer(await api.registriere(email, passwort));
  }, []);

  const abmelden = useCallback(async () => {
    await api.meldeAb();
    setNutzer(null);
  }, []);

  const wert: AuthWert = { saasModus, nutzer, laden, anmelden, registrieren, abmelden };
  return <AuthContext.Provider value={wert}>{children}</AuthContext.Provider>;
}

/** Zugriff auf den Auth-Kontext; wirft außerhalb des Providers. */
export function useAuth(): AuthWert {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth muss innerhalb von <AuthProvider> verwendet werden');
  return auth;
}
