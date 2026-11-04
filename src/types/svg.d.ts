// An imported .svg file is a component that draws it at the size set in the
// file (see metro.config.js).
declare module '*.svg' {
  import type {FC} from 'react';
  import type {SvgProps} from 'react-native-svg';

  const Icon: FC<SvgProps>;
  export default Icon;
}
