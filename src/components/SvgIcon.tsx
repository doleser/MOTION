import {useEffect, useState} from 'react';
import type {ImageSourcePropType} from 'react-native';
import {SvgCss, loadLocalRawResource} from 'react-native-svg/css';

/**
 * Icon files are loaded at runtime (in development, fetched from the Metro
 * server). Keep each one after its first load so screens don't fetch again.
 */
const cache = new Map<ImageSourcePropType, string>();

interface SvgIconProps {
  /** A bundled SVG, e.g. require('../../assets/icons/back.svg'). */
  asset: ImageSourcePropType;
}

/**
 * Draws a bundled SVG file at the size set in the file. Use this instead of
 * LocalSvg: LocalSvg doesn't catch a failed load, which shows up as an
 * uncaught promise error. If the load fails, this draws nothing and tries
 * again the next time it appears.
 */
export function SvgIcon({asset}: SvgIconProps) {
  const [xml, setXml] = useState<string | null>(() => cache.get(asset) ?? null);

  useEffect(() => {
    if (cache.has(asset)) {
      return;
    }
    let cancelled = false;
    loadLocalRawResource(asset).then(
      (loaded) => {
        if (loaded) {
          cache.set(asset, loaded);
        }
        if (!cancelled) {
          setXml(loaded);
        }
      },
      () => {
        // Leave it blank; the next mount tries again.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [asset]);

  const shown = cache.get(asset) ?? xml;
  return shown ? <SvgCss xml={shown} /> : null;
}
