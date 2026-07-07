// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Campanium-Commercial
// Copyright (c) 2026 luckylucab0

/**
 * Abo-Ableitung für den Client. Im Self-Host-Modus (saasModus false) ist alles
 * freigeschaltet – es gibt dort keine Pläne. Nur im SaaS-Modus entscheidet die
 * Plan-Stufe des Kontos über die KI-Features (Durchsetzung passiert zusätzlich
 * serverseitig; der Client blendet nur passend aus bzw. bietet ein Upgrade an).
 */
import { useCallback } from 'react';
import { parsePlan, PLAENE, planErlaubt, type KiFeature, type PlanInfo } from '@campanium/shared';
import { useAuth } from './auth';

export interface PlanWert {
  saasModus: boolean;
  planInfo: PlanInfo;
  /** Reicht der aktuelle Plan für ein Feature? (Self-Host: immer true.) */
  erlaubt: (feature: KiFeature) => boolean;
}

export function usePlan(): PlanWert {
  const { saasModus, nutzer } = useAuth();
  const stufe = parsePlan(nutzer?.plan);
  const erlaubt = useCallback(
    (feature: KiFeature) => !saasModus || planErlaubt(stufe, feature),
    [saasModus, stufe],
  );
  return { saasModus, planInfo: PLAENE[stufe], erlaubt };
}
