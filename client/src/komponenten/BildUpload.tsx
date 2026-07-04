// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Bild-Feld für Entitäts-Formulare: Vorschau, Hochladen, Entfernen.
 * Die Datei geht roh an den Server (der den Dateinamen vergibt); im
 * Formular-State landet nur der Dateiname für das Feld `bild`.
 */
import { useRef, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { bildUrl, ladeBildHoch } from '../api';
import { useI18n } from '../i18n';
import { useStore } from '../store';

export function BildUpload({
  wert,
  onChange,
  alt,
}: {
  /** Aktueller Dateiname (Feld `bild`) oder null. */
  wert: string | null;
  onChange: (datei: string | null) => void;
  /** Alt-Text der Vorschau, z. B. der Entitätsname. */
  alt: string;
}) {
  const { kampagne } = useStore();
  const { t } = useI18n();
  const eingabe = useRef<HTMLInputElement>(null);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const hochladen = async (datei: File | undefined) => {
    if (!datei || !kampagne) return;
    setLaedt(true);
    setFehler(null);
    try {
      onChange(await ladeBildHoch(kampagne.id, datei));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t('Upload fehlgeschlagen'));
    } finally {
      setLaedt(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {wert && kampagne ? (
        <img
          src={bildUrl(kampagne.id, wert)}
          alt={alt}
          className="h-16 w-16 rounded border border-rand object-cover"
        />
      ) : (
        <div
          className="flex h-16 w-16 items-center justify-center rounded border border-dashed border-rand text-text-schwach"
          aria-hidden
        >
          <ImagePlus size={20} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <input
          ref={eingabe}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => void hochladen(e.target.files?.[0])}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border border-rand px-2.5 py-1 text-xs text-text-normal hover:text-gold disabled:opacity-50"
            onClick={() => eingabe.current?.click()}
            disabled={laedt}
          >
            {laedt ? t('Lädt …') : wert ? t('Bild ersetzen') : t('Bild hochladen')}
          </button>
          {wert && (
            <button
              type="button"
              className="flex items-center gap-1 rounded border border-rand px-2.5 py-1 text-xs text-text-schwach hover:text-rot"
              onClick={() => onChange(null)}
            >
              <Trash2 size={12} /> {t('Entfernen')}
            </button>
          )}
        </div>
        {fehler ? (
          <p className="text-xs text-rot">{fehler}</p>
        ) : (
          <p className="text-xs text-text-schwach">{t('PNG, JPEG, WebP oder GIF · max. 10 MB')}</p>
        )}
      </div>
    </div>
  );
}
