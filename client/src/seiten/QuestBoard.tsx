/**
 * Quest-Kanban-Board: vier Spalten (offen / aktiv / erledigt /
 * fehlgeschlagen), Quests per HTML5-Drag-&-Drop verschiebbar.
 * Im Spieler-Modus read-only (Drag ist deaktiviert).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Quest, QuestStatus } from '@grimoire/shared';
import { QUEST_STATUS } from '@grimoire/shared';
import { IST_SPIELER_MODUS } from '../api';
import { pfadFuer } from '../hilfen';
import { useStore } from '../store';
import { DmBadge } from '../komponenten/Badge';

const SPALTEN_TITEL: Record<QuestStatus, string> = {
  offen: 'Offen',
  aktiv: 'Aktiv',
  erledigt: 'Erledigt',
  fehlgeschlagen: 'Fehlgeschlagen',
};

export function QuestBoard() {
  const { entitaeten, aktualisieren, perId } = useStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const [ueberSpalte, setUeberSpalte] = useState<QuestStatus | null>(null);

  const quests = entitaeten.filter((e): e is Quest => e.typ === 'quest');

  const ablegen = (status: QuestStatus) => {
    if (dragId) {
      const quest = quests.find((q) => q.id === dragId);
      if (quest && quest.status !== status) {
        void aktualisieren('quest', dragId, { status });
      }
    }
    setDragId(null);
    setUeberSpalte(null);
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {QUEST_STATUS.map((status) => {
        const spalte = quests.filter((q) => q.status === status);
        return (
          <div
            key={status}
            className={`karte min-h-40 p-2.5 transition-colors ${
              ueberSpalte === status ? 'border-gold bg-gold-flaeche' : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setUeberSpalte(status);
            }}
            onDragLeave={() => setUeberSpalte(null)}
            onDrop={() => ablegen(status)}
          >
            <h2 className="mb-2.5 px-1 text-xs uppercase tracking-[0.15em] text-text-schwach">
              {SPALTEN_TITEL[status]}{' '}
              <span className="text-text-schwach/60">({spalte.length})</span>
            </h2>
            <div className="space-y-2">
              {spalte.map((quest) => (
                <Link
                  key={quest.id}
                  to={pfadFuer(quest)}
                  draggable={!IST_SPIELER_MODUS}
                  onDragStart={() => setDragId(quest.id)}
                  onDragEnd={() => setDragId(null)}
                  className={`karte karte-ornament block cursor-grab bg-flaeche-3 p-2.5 active:cursor-grabbing ${
                    dragId === quest.id ? 'opacity-40' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-display text-sm text-text-stark">{quest.name}</span>
                    {quest.dmOnly && <DmBadge />}
                  </div>
                  {quest.auftrag && (
                    <p className="mt-1 line-clamp-2 text-xs text-text-schwach">{quest.auftrag}</p>
                  )}
                  {quest.questgeberId && (
                    <p className="mt-1.5 text-[11px] text-gold-hell">
                      {perId(quest.questgeberId)?.name}
                    </p>
                  )}
                  {quest.fortschritt.length > 0 && (
                    <p className="mt-1 text-[11px] text-text-schwach">
                      ☑ {quest.fortschritt.filter((f) => f.erledigt).length}/
                      {quest.fortschritt.length}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
