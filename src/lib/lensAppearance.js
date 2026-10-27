import { localData } from '@/lib/localData';

export const LENS_ACCENTS = [
  { id: 'aurora', name: 'Aurora', start: '#72f0c0', end: '#7b8cff' },
  { id: 'sunset', name: 'Sunset', start: '#ff9a76', end: '#ff5ca8' },
  { id: 'ocean', name: 'Ocean', start: '#52ddff', end: '#5179ff' },
  { id: 'berry', name: 'Berry', start: '#df8cff', end: '#ff71b8' },
  { id: 'citrus', name: 'Citrus', start: '#d8f56e', end: '#46d8b1' },
];

const STORAGE_KEY = 'lens_accent';

export function getLensAccent() {
  const saved = localData.get(STORAGE_KEY);
  return LENS_ACCENTS.find((accent) => accent.id === saved) || LENS_ACCENTS[0];
}

export function setLensAccent(id) {
  const accent = LENS_ACCENTS.find((item) => item.id === id) || LENS_ACCENTS[0];
  localData.set(STORAGE_KEY, accent.id);
  return accent;
}
