/**
 * SVG filter definitions for Apple Liquid Glass (iOS 26 style) refraction.
 *
 * `feTurbulence` generates an organic noise pattern; `feDisplacementMap`
 * warps the backdrop pixels along that noise — this is the "bending light
 * through glass" effect that plain `backdrop-filter: blur()` cannot do.
 *
 * Mounted once, globally. Elements reference it via
 * `backdrop-filter: url(#liquid-glass-refract)`.
 *
 * A slow animated drift on the turbulence seed gives the surface a
 * subtle living-liquid shimmer.
 *
 * —— 从 222/project/src/components/LiquidGlassDefs.tsx 百分百复刻。
 */
export function LiquidGlassDefs() {
  return (
    <svg
      aria-hidden
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        {/* Standard refraction — smaller displacement for thin controls */}
        <filter id="liquid-glass-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.008 0.012"
            numOctaves={2}
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="2" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="18"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* Stronger refraction — larger displacement for the big pet panel */}
        <filter id="liquid-glass-refract-lg" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.009"
            numOctaves={3}
            seed="11"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="3" result="softNoise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softNoise"
            scale="32"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
