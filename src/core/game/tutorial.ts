/**
 * Tutoriel progressif : une suite d'étapes validées l'une après l'autre (la suivante n'est testée que quand la
 * précédente est faite). Les étapes de mouvement se valident par un « signal » envoyé par le jeu ; les autres se lisent
 * dans l'état du monde (sac, machines).
 */
import type { Inventory } from './inventory';

export interface TutorialStep {
  id: string;
  /** 1 : fondations mobiles, 2 : récolte, 3 : premier réseau (four). */
  group: 1 | 2 | 3;
  /** Actions du jeu dont on affiche la touche dans le texte (clés des réglages de commandes). */
  keys: string[];
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  { id: 'move', group: 1, keys: ['forward', 'left', 'backward', 'right'] },
  { id: 'jump', group: 1, keys: ['jump'] },
  { id: 'crouch', group: 1, keys: ['crouch'] },
  { id: 'sprint', group: 1, keys: ['sprint'] },
  { id: 'look', group: 1, keys: [] },
  { id: 'view', group: 1, keys: ['cycleView'] },
  { id: 'map', group: 1, keys: ['map'] },
  { id: 'wood', group: 2, keys: ['interact'] },
  { id: 'stone', group: 2, keys: ['interact'] },
  { id: 'tool', group: 2, keys: ['inventory'] },
  { id: 'furnace', group: 3, keys: ['inventory'] },
  { id: 'coal', group: 3, keys: ['use'] },
  { id: 'iron', group: 3, keys: [] },
];

export interface TutorialContext {
  /** Signaux reçus depuis la dernière étape validée. */
  flags: ReadonlySet<string>;
  inventory: Inventory;
  /** Le joueur a un outil en main (ou dans le sac). */
  hasTool: boolean;
  machines: {
    type: string;
    fuelCount: number;
    slots: { item: string }[];
    stockItem: string | null;
  }[];
}

/** Étapes de mouvement validées par un signal du jeu. */
const SIGNAL_STEPS = new Set(['jump', 'crouch', 'sprint', 'map']);

/** Étapes qui demandent plusieurs gestes (tous les signaux de la liste) : la barre de progression les compte. */
export const STEP_NEEDS: Readonly<Record<string, readonly string[]>> = {
  move: ['forward', 'left', 'backward', 'right'],
  look: ['lookLeft', 'lookRight', 'lookUp', 'lookDown'],
  view: ['view:first', 'view:third', 'view:top'],
};

/** Étapes de récolte : combien d'unités à ramasser. */
export const STEP_COUNTS: Readonly<Record<string, { item: string; count: number }>> = {
  wood: { item: 'wood', count: 3 },
  stone: { item: 'stone', count: 3 },
};

/** Avancement d'une étape : gestes faits sur gestes demandés (1 sur 1 pour les étapes simples). */
export function stepProgress(id: string, ctx: TutorialContext): { have: number; total: number } {
  const needs = STEP_NEEDS[id];
  if (needs) return { have: needs.filter((n) => ctx.flags.has(n)).length, total: needs.length };
  const goal = STEP_COUNTS[id];
  if (goal) return { have: Math.min(goal.count, ctx.inventory[goal.item] ?? 0), total: goal.count };
  return { have: stepComplete(id, ctx) ? 1 : 0, total: 1 };
}

export function stepComplete(id: string, ctx: TutorialContext): boolean {
  if (STEP_NEEDS[id] || STEP_COUNTS[id]) {
    const p = stepProgress(id, ctx);
    return p.have >= p.total;
  }
  if (SIGNAL_STEPS.has(id)) return ctx.flags.has(id);
  switch (id) {
    case 'tool':
      return ctx.hasTool;
    case 'furnace':
      return ctx.machines.some((m) => m.type === 'furnace');
    case 'coal':
      return ctx.machines.some(
        (m) => m.type === 'furnace' && (m.fuelCount > 0 || m.slots.some((s) => s.item === 'coal')),
      );
    case 'iron':
      return (
        (ctx.inventory.iron_ingot ?? 0) > 0 ||
        ctx.flags.has('iron') ||
        ctx.machines.some((m) => m.type === 'furnace' && m.stockItem === 'iron_ingot')
      );
    default:
      return false;
  }
}

/** Progression d'un tutoriel (enregistrée dans les changements du monde). */
export class Tutorial {
  private flags = new Set<string>();
  private last: Omit<TutorialContext, 'flags'> = { inventory: {}, hasTool: false, machines: [] };

  constructor(
    private readonly saved: { tutorialDone: string[]; tutorialSkipped: boolean },
    private readonly enabled: boolean,
  ) {}

  /** Étape en cours, ou null (tutoriel terminé, passé ou désactivé). */
  current(): TutorialStep | null {
    if (!this.enabled || this.saved.tutorialSkipped) return null;
    return TUTORIAL_STEPS.find((s) => !this.saved.tutorialDone.includes(s.id)) ?? null;
  }

  done(): string[] {
    return this.saved.tutorialDone;
  }

  /** Un signal du jeu (le joueur a sauté, ouvert la carte…). */
  signal(name: string): void {
    this.flags.add(name);
  }

  /** Valide les étapes accomplies ; renvoie la dernière validée (pour la fanfare) ou null. */
  update(ctx: Omit<TutorialContext, 'flags'>): TutorialStep | null {
    this.last = ctx;
    let last: TutorialStep | null = null;
    for (let step = this.current(); step; step = this.current()) {
      if (!stepComplete(step.id, { ...ctx, flags: this.flags })) break;
      this.saved.tutorialDone.push(step.id);
      this.flags.clear();
      last = step;
    }
    return last;
  }

  /** Avancement de l'étape en cours (d'après le dernier état du monde reçu), ou null s'il n'y en a pas. */
  progress(): { have: number; total: number } | null {
    const step = this.current();
    return step ? stepProgress(step.id, { ...this.last, flags: this.flags }) : null;
  }

  skip(): void {
    this.saved.tutorialSkipped = true;
  }
}
