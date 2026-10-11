import type { Platform } from "@/types/database";

export function PlatformBadge({
  platform,
  compact = false
}: {
  platform: Platform;
  compact?: boolean;
}) {
  const instagram = platform === "instagram";
  const whatsapp = platform === "whatsapp";
  const color = instagram
    ? "text-fuchsia-700"
    : whatsapp
      ? "text-emerald-700"
      : "text-blue-700";

  return (
    <span
      className={
        "inline-flex items-center gap-1.5 font-semibold capitalize " +
        color
      }
    >
      <span
        className={
          "grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold text-white shadow-sm " +
          (instagram
            ? "bg-gradient-to-br from-violet-600 via-pink-500 to-orange-400"
            : whatsapp
              ? "bg-emerald-600"
              : "bg-blue-600")
        }
      >
        {instagram ? "◎" : whatsapp ? "◔" : "f"}
      </span>
      {!compact && platform}
    </span>
  );
}

