import type {MapStyleElement} from 'react-native-maps';

/**
 * Dark Google Maps style (Android), to get close to the Figma map. iOS uses
 * Apple Maps' own dark mode instead (`userInterfaceStyle="dark"`).
 */
export const darkMapStyle: MapStyleElement[] = [
  {elementType: 'geometry', stylers: [{color: '#191919'}]},
  {elementType: 'labels.text.fill', stylers: [{color: '#b0b0ad'}]},
  {elementType: 'labels.text.stroke', stylers: [{color: '#0d0d0d'}]},
  {elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
  {featureType: 'poi', stylers: [{visibility: 'off'}]},
  {featureType: 'transit', stylers: [{visibility: 'off'}]},
  {featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{color: '#232323'}]},
  {featureType: 'road', elementType: 'geometry', stylers: [{color: '#2e2e2e'}]},
  {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#3a3a3a'}]},
  {featureType: 'water', elementType: 'geometry', stylers: [{color: '#0d0d0d'}]},
];
