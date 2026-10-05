import { splitBinding, type ActionId } from '../settings/controls';
import { getSettings } from '../settings/store';

/** Champ de saisie (texte, liste) : les touches y servent à écrire, pas à jouer. */
function isTextField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

/** Bouton ou fenêtre de l'interface : Tab, Espace, flèches y servent à naviguer. */
function isInterfaceControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('button, a, [role="dialog"], [role="tab"], [role="alertdialog"]') !== null
  );
}

const MODIFIER_CODES: Record<string, string[]> = {
  Shift: ['ShiftLeft', 'ShiftRight'],
  Control: ['ControlLeft', 'ControlRight'],
  Alt: ['AltLeft', 'AltRight'],
  Meta: ['MetaLeft', 'MetaRight'],
};

/**
 * État des touches / boutons / molette. Les actions du jeu se lisent avec `isActionActive`,
 * qui applique les touches configurées par le joueur (y compris les combinaisons de 2 touches).
 * Limite connue : pas encore de contextes d'actions (voir docs/parametres.md).
 */
export class Input {
  private readonly pressed = new Set<string>();
  private wheelUp = false;
  private wheelDown = false;
  private attached = false;

  constructor(private readonly wheelTarget: HTMLElement) {}

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' || isTextField(e.target)) return;
    this.pressed.add(e.code);
    // Évite que les touches du jeu fassent défiler la page ou déplacent le focus, sauf dans l'interface.
    const scrollsPage = e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab';
    if (scrollsPage && !isInterfaceControl(e.target)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.pressed.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent): void => {
    // Les clics sur l'interface (boutons, fenêtres) ne comptent pas comme des actions de jeu.
    if (e.target !== this.wheelTarget && !document.pointerLockElement) return;
    this.pressed.add(`Mouse${e.button}`);
  };
  private onMouseUp = (e: MouseEvent): void => {
    this.pressed.delete(`Mouse${e.button}`);
  };
  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (e.deltaY < 0) this.wheelUp = true;
    else if (e.deltaY > 0) this.wheelDown = true;
  };
  private onBlur = (): void => {
    this.pressed.clear();
  };
  private onContextMenu = (e: Event): void => e.preventDefault();

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
    this.wheelTarget.addEventListener('wheel', this.onWheel, { passive: false });
    this.wheelTarget.addEventListener('contextmenu', this.onContextMenu);
  }

  detach(): void {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
    this.wheelTarget.removeEventListener('wheel', this.onWheel);
    this.wheelTarget.removeEventListener('contextmenu', this.onContextMenu);
    this.pressed.clear();
  }

  private partActive(part: string): boolean {
    if (part === 'WheelUp') return this.wheelUp;
    if (part === 'WheelDown') return this.wheelDown;
    const modifier = MODIFIER_CODES[part];
    if (modifier) return modifier.some((c) => this.pressed.has(c));
    return this.pressed.has(part);
  }

  isBindingActive(binding: string): boolean {
    return splitBinding(binding).every((part) => this.partActive(part));
  }

  isActionActive(action: ActionId): boolean {
    return getSettings().controls[action].some((b) => b !== null && this.isBindingActive(b));
  }

  /** À appeler en fin d'image : la molette ne compte que pour l'image où elle a tourné. */
  endFrame(): void {
    this.wheelUp = false;
    this.wheelDown = false;
  }
}
