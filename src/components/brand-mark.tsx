import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Curtis Image Studio"
      {...props}
    >
      <defs>
        <linearGradient id="curtis-coral" x1="18" y1="16" x2="78" y2="82">
          <stop stopColor="#FFB39D" />
          <stop offset="0.48" stopColor="#E98068" />
          <stop offset="1" stopColor="#C95749" />
        </linearGradient>
        <linearGradient id="curtis-glow" x1="20" y1="18" x2="78" y2="80">
          <stop stopColor="#FFE1D6" stopOpacity="0.92" />
          <stop offset="1" stopColor="#F2A083" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="25" fill="#17233B" />
      <path
        d="M23.5 39.5C28.7 27.3 40.8 19 54.8 19c10.5 0 19.7 4.9 25.7 12.6"
        stroke="#F7F2EA"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.92"
      />
      <path
        d="M72.5 56.5C67.3 68.7 55.2 77 41.2 77c-10.5 0-19.7-4.9-25.7-12.6"
        stroke="#F7F2EA"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      />
      <circle cx="48" cy="48" r="27" fill="url(#curtis-coral)" />
      <circle cx="48" cy="48" r="27" fill="url(#curtis-glow)" />
      <circle cx="48" cy="48" r="18.5" stroke="#FFF7F1" strokeWidth="2.5" opacity="0.88" />
      <circle cx="48" cy="48" r="8.5" fill="#17233B" />
      <circle cx="45.5" cy="45.5" r="2.5" fill="#FFF7F1" opacity="0.9" />
      <circle cx="78" cy="23" r="5" fill="#9FD4C4" />
      <path
        d="M78 15v16M70 23h16"
        stroke="#D6F2E8"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.8"
      />
    </svg>
  );
}
