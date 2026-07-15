// Photo portrait per avatar key. Keys mirror the backend AVATARS list
// (defaultContent.engine.ts) and the filenames in src/assets/profiles.
import alex from './assets/profiles/alex.png';
import maya from './assets/profiles/maya.png';
import omar from './assets/profiles/omar.png';
import aya from './assets/profiles/aya.png';
import james from './assets/profiles/james.png';
import ava from './assets/profiles/ava.png';

const AVATAR_IMAGES = { alex, maya, omar, aya, james, ava };

// The portrait URL for an avatar key, or null when there's no bundled image
// (callers fall back to the procedural AvatarBadge).
export function avatarImage(key) {
  return (key && AVATAR_IMAGES[key]) || null;
}

export default AVATAR_IMAGES;
