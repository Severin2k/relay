"use client";

interface MessageProps {
  role: "user" | "assistant";
  content: string;
}

export function Message({ role, content }: MessageProps) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap ${
          role === "user"
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
