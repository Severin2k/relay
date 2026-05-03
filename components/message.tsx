"use client";

interface MessageProps {
  role: "user" | "plan" | "coder";
  content: string;
  to?: "plan" | "coder";
  auto?: boolean;
  build?: boolean;
}

export function Message({ role, content, to, auto, build }: MessageProps) {
  if (role === "user") {
    const label = to === "coder" ? "An Coder" : to === "plan" ? "An Plan" : "";
    return (
      <div className="flex justify-end mb-3 msg-appear">
        <div className="max-w-[75%] rounded-2xl rounded-br-md px-4 py-2.5 whitespace-pre-wrap text-[15px] leading-relaxed"
          style={{ background: "var(--accent)", color: "white" }}>
          {label && (
            <span className="text-[11px] font-medium opacity-60 block mb-0.5 tracking-wide uppercase">{label}</span>
          )}
          {content}
        </div>
      </div>
    );
  }

  const isPlan = role === "plan";
  const isBuild = build;

  const bg = isBuild
    ? "var(--green-bg)"
    : isPlan
      ? "var(--bg-primary)"
      : "var(--indigo-bg)";

  const borderColor = isBuild
    ? "var(--green)"
    : isPlan
      ? "var(--border)"
      : "var(--indigo)";

  const labelText = isBuild ? "Coder (Build)" : isPlan ? "Plan" : "Coder";
  const labelColor = isBuild
    ? "var(--green)"
    : isPlan
      ? "var(--text-tertiary)"
      : "var(--indigo)";

  return (
    <div className="flex justify-start mb-3 msg-appear">
      <div
        className="max-w-[75%] rounded-2xl rounded-bl-md px-4 py-2.5 whitespace-pre-wrap text-[15px] leading-relaxed shadow-sm"
        style={{ background: bg, borderLeft: `3px solid ${borderColor}` }}
      >
        <span className="text-[11px] font-semibold block mb-0.5 tracking-wide uppercase flex items-center gap-1.5"
          style={{ color: labelColor }}>
          {labelText}
          {auto && <span className="font-normal opacity-50 normal-case tracking-normal">auto</span>}
          {isBuild && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--green)" }} />}
        </span>
        {content || (
          <span className="inline-flex gap-1 py-1">
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: labelColor, opacity: 0.4, animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: labelColor, opacity: 0.4, animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: labelColor, opacity: 0.4, animationDelay: "300ms" }} />
          </span>
        )}
      </div>
    </div>
  );
}
