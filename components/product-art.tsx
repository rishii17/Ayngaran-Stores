export function GaneshMark() {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 10 24 19h16L32 10Z" stroke="currentColor" strokeWidth="2" />
      <path
        d="M25 24c-17-11-20 14-6 17l7-9m13-8c17-11 20 14 6 17l-7-9"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path
        d="M23 27c0-11 18-11 18 0 0 10-9 10-9 19 0 7 9 7 9 1M22 44c-9 7-6 11 10 11s20-4 11-11"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="28" cy="28" r="1.6" fill="currentColor" />
      <circle cx="36" cy="28" r="1.6" fill="currentColor" />
      <path d="M32 21v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
export default function ProductArt({ product }: { product: any }) {
  if (product.image)
    return (
      <img
        src={product.image}
        alt={product.name}
        loading="lazy"
        className="product-image"
      />
    );
  const type = product.art || "rice";
  const colors: Record<string, string> = {
    rice: "#9d4b41",
    dhal: "#bd7734",
    sugar: "#6d9aaa",
    oil: "#7c8947",
    milk: "#5f92aa",
    tea: "#507c60",
    flour: "#b9905c",
    spice: "#c25f3b",
    biscuit: "#ad794b",
    eggs: "#b9926f",
    water: "#6eabc2",
  };
  const c = colors[type] || colors.rice;
  return (
    <svg viewBox="0 0 160 130" className="product-art" aria-hidden="true">
      <defs>
        <linearGradient id={"shade" + product.id} x1="0" x2="1">
          <stop stopColor="#fff" stopOpacity=".48" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="113" rx="35" ry="6" fill="#42301b" opacity=".08" />
      {type === "oil" || type === "water" ? (
        <>
          <path
            d="M70 15h20v24c0 7 14 11 14 23v43q0 8-8 8H64q-8 0-8-8V62c0-12 14-16 14-23Z"
            fill={type === "oil" ? "#e5c569" : "#c9e6e8"}
            stroke={c}
          />
          <rect x="68" y="11" width="24" height="11" rx="3" fill={c} />
          <rect x="57" y="61" width="46" height="34" rx="2" fill="#fffff4" />
          <path d="M76 72q-12 0-6 11 15 0 13-17" fill={c} />
          <text x="80" y="92" textAnchor="middle" fontSize="5" fill={c}>
            {type === "oil" ? "PURE COCONUT" : "SPRING WATER"}
          </text>
        </>
      ) : type === "eggs" ? (
        <>
          <path d="m36 88 15 23h60l13-23Z" fill="#b9a995" />
          {[55, 80, 105].map((x, i) => (
            <ellipse
              key={x}
              cx={x}
              cy={79 - (i % 2) * 8}
              rx="15"
              ry="21"
              fill={i % 2 ? "#f6e4c9" : "#e8cdac"}
              stroke="#ccb496"
            />
          ))}
          <path
            d="m35 93 11 20h70l10-20-17 5-15-5-16 5-16-5-15 5Z"
            fill="#c9baa7"
          />
        </>
      ) : type === "milk" ? (
        <>
          <path
            d="m58 35 10-19h25l10 19v76H58Z"
            fill="#f6f8f1"
            stroke="#adc3cb"
          />
          <path d="M58 35h45v22H58Zm0 51h45v25H58Z" fill={c} />
          <path d="m68 16 9 19h26L93 16Z" fill="#b5d2dd" />
          <text
            x="80"
            y="74"
            textAnchor="middle"
            fill={c}
            fontWeight="bold"
            fontSize="13"
          >
            MILK
          </text>
          <text x="80" y="83" textAnchor="middle" fill={c} fontSize="5">
            FRESH & PURE
          </text>
        </>
      ) : (
        <>
          <path
            d="m51 20 58 1-3 16 8 66q1 10-11 10H54q-11 0-10-10l10-66Z"
            fill={type === "tea" ? c : "#eaddc4"}
            stroke={c}
            strokeOpacity=".3"
          />
          <path d="m51 20 58 1-1 8H52Z" fill={c} />
          <path d="M49 53h60l3 36H46Z" fill={c} />
          <path
            d="M52 23h54l-3 15 8 66q0 6-7 6H54q-8 0-7-7l10-66Z"
            fill={"url(#shade" + product.id + ")"}
          />
          <text
            x="79"
            y="65"
            textAnchor="middle"
            fill="#fff8e6"
            fontSize="5"
            letterSpacing="1"
          >
            AYNGARAN
          </text>
          <text
            x="79"
            y="79"
            textAnchor="middle"
            fill="white"
            fontSize="10"
            fontWeight="bold"
          >
            {type === "dhal"
              ? "DHAL"
              : type === "spice"
                ? "SPICES"
                : type.toUpperCase()}
          </text>
          <text
            x="79"
            y="100"
            textAnchor="middle"
            fill={type === "tea" ? "#eaddc4" : c}
            fontSize="5"
          >
            PREMIUM QUALITY
          </text>
          <path
            d="m77 35 4 11m-3-5-5-2m6 0 4-4"
            stroke={type === "tea" ? "#dfc78e" : c}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}
