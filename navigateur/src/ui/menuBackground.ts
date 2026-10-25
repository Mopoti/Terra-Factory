interface BackgroundItem {
  type: 'image' | 'video';
  file: string;
}
interface BackgroundManifest {
  intervalSeconds?: number;
  items?: BackgroundItem[];
}

/**
 * Fond du menu : images/vidéos listées dans public/menu-backgrounds/manifest.json.
 * Liste vide ou manifeste introuvable : fond sombre par défaut (défini en CSS).
 * Renvoie une fonction qui arrête le fond.
 */
export async function mountMenuBackground(container: HTMLElement): Promise<() => void> {
  container.replaceChildren();
  let manifest: BackgroundManifest = {};
  try {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}menu-backgrounds/manifest.json`);
    if (res.ok) manifest = (await res.json()) as BackgroundManifest;
  } catch {
    /* pas de manifeste : fond par défaut */
  }
  const items = manifest.items ?? [];
  if (items.length === 0) return () => undefined;

  const base = import.meta.env.BASE_URL;
  const slides = items.map((item) => {
    const node =
      item.type === 'video'
        ? Object.assign(document.createElement('video'), {
            muted: true,
            loop: true,
            playsInline: true,
            autoplay: true,
          })
        : document.createElement('img');
    node.src = `${base}menu-backgrounds/${item.file}`;
    node.className = 'bg-slide';
    container.append(node);
    return node;
  });

  let index = 0;
  const show = (i: number): void => slides.forEach((s, k) => s.classList.toggle('active', k === i));
  show(0);
  const ms = Math.max(3, manifest.intervalSeconds ?? 8) * 1000;
  const timer =
    slides.length > 1
      ? window.setInterval(() => show((index = (index + 1) % slides.length)), ms)
      : 0;
  return () => window.clearInterval(timer);
}
