import buckScout from "@/assets/avatars/buck-scout.jpg";
import foxScholar from "@/assets/avatars/fox-scholar.jpg";
import owlSage from "@/assets/avatars/owl-sage.jpg";
import bearBookworm from "@/assets/avatars/bear-bookworm.jpg";
import rabbitQuick from "@/assets/avatars/rabbit-quick.jpg";
import wolfLeader from "@/assets/avatars/wolf-leader.jpg";
import pandaCheer from "@/assets/avatars/panda-cheer.jpg";
import hedgehogGrad from "@/assets/avatars/hedgehog-grad.jpg";

export interface AvatarOption {
  key: string;
  label: string;
  src: string;
}

export const AVATARS: AvatarOption[] = [
  { key: "buck-scout", label: "Buck Scout", src: buckScout },
  { key: "fox-scholar", label: "Fox Scholar", src: foxScholar },
  { key: "owl-sage", label: "Owl Sage", src: owlSage },
  { key: "bear-bookworm", label: "Bear Bookworm", src: bearBookworm },
  { key: "rabbit-quick", label: "Quick Rabbit", src: rabbitQuick },
  { key: "wolf-leader", label: "Wolf Leader", src: wolfLeader },
  { key: "panda-cheer", label: "Red Panda", src: pandaCheer },
  { key: "hedgehog-grad", label: "Grad Hedgehog", src: hedgehogGrad },
];

export const DEFAULT_AVATAR_KEY = "buck-scout";

export function avatarSrc(key: string | null | undefined): string {
  const found = AVATARS.find((a) => a.key === key);
  return (found ?? AVATARS[0]).src;
}
