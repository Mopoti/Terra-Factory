/** Fabrique de maillages simples (couleurs par sommet, ombrage plat) pour fusionner un chunk en un seul objet. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

export const shade = (c: Rgb, f: number): Rgb => ({
  r: Math.min(1, c.r * f),
  g: Math.min(1, c.g * f),
  b: Math.min(1, c.b * f),
});

type Vec = [number, number, number];

export class MeshBuilder {
  readonly positions: number[] = [];
  readonly normals: number[] = [];
  readonly colors: number[] = [];

  /**
   * Ajoute un modèle 3D préparé (voir `models.ts`) : posé au sol centré sur (x, z), tourné de `turns` quarts de tour
   * autour de la verticale, mis à l'échelle uniformément. `mix` mélange sa couleur avec `tint` (0 = couleur du modèle).
   */
  model(
    m: {
      positions: Float32Array;
      normals: Float32Array;
      colors: Float32Array;
      index: Uint32Array;
      min: { x: number; y: number; z: number };
      size: { x: number; y: number; z: number };
    },
    x: number,
    y: number,
    z: number,
    turns: number,
    scale: number,
    tint?: Rgb,
    mix = 0,
    mirror = false,
    scaleY = scale,
  ): void {
    const a = (turns * Math.PI) / 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const cx = m.min.x + m.size.x / 2;
    const cz = m.min.z + m.size.z / 2;
    const place = (i: number): void => {
      const flip = mirror ? -1 : 1;
      const px = (m.positions[i * 3] - cx) * scale * flip;
      const py = (m.positions[i * 3 + 1] - m.min.y) * scaleY;
      const pz = (m.positions[i * 3 + 2] - cz) * scale;
      this.positions.push(x + px * c + pz * s, y + py, z - px * s + pz * c);
      const nx = m.normals[i * 3] * flip;
      const nz = m.normals[i * 3 + 2];
      this.normals.push(nx * c + nz * s, m.normals[i * 3 + 1], -nx * s + nz * c);
      const r = m.colors[i * 3];
      const g = m.colors[i * 3 + 1];
      const b = m.colors[i * 3 + 2];
      if (tint && mix > 0) {
        this.colors.push(r + (tint.r - r) * mix, g + (tint.g - g) * mix, b + (tint.b - b) * mix);
      } else this.colors.push(r, g, b);
    };
    // Un modèle retourné (miroir) a ses triangles à l'envers : on inverse l'ordre des sommets.
    for (let k = 0; k < m.index.length; k += 3) {
      if (mirror) {
        place(m.index[k]);
        place(m.index[k + 2]);
        place(m.index[k + 1]);
      } else {
        place(m.index[k]);
        place(m.index[k + 1]);
        place(m.index[k + 2]);
      }
    }
  }

  /** Ajoute un triangle ; la normale est calculée (ombrage plat). */
  tri(a: Vec, b: Vec, c: Vec, color: Rgb): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const p of [a, b, c]) {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(nx, ny, nz);
      this.colors.push(color.r, color.g, color.b);
    }
  }

  quad(a: Vec, b: Vec, c: Vec, d: Vec, color: Rgb): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** Boîte centrée en (x, z), posée à la hauteur y0. Le dessous n'est dessiné que si `bottom` est vrai (objets qu'on peut voir d'en dessous). */
  box(
    x: number,
    y0: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: Rgb,
    bottom = false,
  ): void {
    const x0 = x - sx / 2;
    const x1 = x + sx / 2;
    const z0 = z - sz / 2;
    const z1 = z + sz / 2;
    const y1 = y0 + sy;
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], color);
    if (bottom)
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade(color, 0.6));
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(color, 0.85));
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], shade(color, 0.85));
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], shade(color, 0.75));
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(color, 0.75));
  }

  /** Cône (ou tronc de cône) à `sides` côtés, base à y0. */
  cone(
    x: number,
    y0: number,
    z: number,
    radius: number,
    height: number,
    sides: number,
    color: Rgb,
    topRadius = 0,
  ): void {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const b0: Vec = [x + Math.cos(a0) * radius, y0, z + Math.sin(a0) * radius];
      const b1: Vec = [x + Math.cos(a1) * radius, y0, z + Math.sin(a1) * radius];
      const f = 0.8 + 0.2 * Math.cos((a0 + a1) / 2 - 0.8);
      if (topRadius === 0) {
        this.tri(b1, b0, [x, y0 + height, z], shade(color, f));
      } else {
        const t0: Vec = [x + Math.cos(a0) * topRadius, y0 + height, z + Math.sin(a0) * topRadius];
        const t1: Vec = [x + Math.cos(a1) * topRadius, y0 + height, z + Math.sin(a1) * topRadius];
        this.quad(b1, b0, t0, t1, shade(color, f));
      }
    }
  }

  /** Octaèdre étiré (rochers) : demi-axes rx, ry, rz, centré à (x, y0 + ry, z). */
  octahedron(
    x: number,
    y0: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    color: Rgb,
    spin: number,
  ): void {
    const cy = y0 + ry;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    const at = (dx: number, dy: number, dz: number): Vec => [
      x + dx * cos - dz * sin,
      cy + dy,
      z + dx * sin + dz * cos,
    ];
    const px = at(rx, 0, 0);
    const nx = at(-rx, 0, 0);
    const pz = at(0, 0, rz);
    const nz = at(0, 0, -rz);
    const top = at(0, ry, 0);
    const bottom = at(0, -ry, 0);
    this.tri(px, pz, top, shade(color, 1.0));
    this.tri(pz, nx, top, shade(color, 0.9));
    this.tri(nx, nz, top, shade(color, 0.8));
    this.tri(nz, px, top, shade(color, 0.95));
    this.tri(pz, px, bottom, shade(color, 0.6));
    this.tri(nx, pz, bottom, shade(color, 0.6));
    this.tri(nz, nx, bottom, shade(color, 0.6));
    this.tri(px, nz, bottom, shade(color, 0.6));
  }
}
