declare module "vanta/dist/vanta.topology.min" {
  import type p5 from "p5";

  interface VantaEffect {
    destroy(): void;
  }

  interface VantaTopologyOptions {
    el: string | HTMLElement;
    p5: typeof p5;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    backgroundColor?: number;
  }

  export default function TOPOLOGY(options: VantaTopologyOptions): VantaEffect;
}
