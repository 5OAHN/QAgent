"use client";

import React, { useState } from "react";

// Design tokens
export const COLORS = {
  indigo: "#0066cc",
  indigoDark: "#0055aa",
  indigoBg: "#eff6ff",
  indigoBg2: "#dbeafe",
  green: "#16a34a",
  greenBg: "#f0fdf4",
  red: "#dc2626",
  redBg: "#fef2f2",
  amber: "#d97706",
  amberBg: "#fffbeb",
  glass: "#ffffff",
  border: "#e0e0e0",
  borderSoft: "#f0f0f0",
  text: "#1d1d1f",
  textMid: "#6b7280",
  textLight: "#9ca3af",
  textFaint: "#d1d5db",
  bgGray: "#f5f5f7",
};

// ── Card wrapper component ──────────────────────────────────────────────────
export function Card({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: COLORS.glass,
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Card header component ──────────────────────────────────────────────────
export function CardHeader({
  title,
  subtitle,
  rightElement,
  style,
}: {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${COLORS.borderSoft}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...style,
      }}
    >
      <div>
        <h3
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: COLORS.text,
            margin: 0,
          }}
        >
          {title}
        </h3>
        {subtitle && (
          <p
            style={{
              fontSize: 11,
              color: COLORS.textLight,
              margin: "4px 0 0",
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightElement && rightElement}
    </div>
  );
}

// ── Badge component ────────────────────────────────────────────────────────
export function Badge({
  label,
  variant = "default",
  size = "md",
}: {
  label: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  size?: "sm" | "md" | "lg";
}) {
  const variants = {
    default: { bg: COLORS.indigoBg, color: COLORS.indigo },
    success: { bg: COLORS.greenBg, color: COLORS.green },
    error: { bg: COLORS.redBg, color: COLORS.red },
    warning: { bg: COLORS.amberBg, color: COLORS.amber },
    info: { bg: COLORS.indigoBg, color: COLORS.indigo },
  };

  const sizes = {
    sm: { fontSize: 10, padding: "2px 8px" },
    md: { fontSize: 11, padding: "4px 12px" },
    lg: { fontSize: 12, padding: "6px 14px" },
  };

  const v = variants[variant];
  const s = sizes[size];

  return (
    <span
      style={{
        display: "inline-block",
        background: v.bg,
        color: v.color,
        borderRadius: 999,
        fontWeight: 600,
        ...s,
        border: `1px solid ${v.color}33`,
      }}
    >
      {label}
    </span>
  );
}

// ── Status badge component ─────────────────────────────────────────────────
export function StatusBadge({
  status,
}: {
  status: "Pass" | "Fail" | "Pending";
}) {
  const map = {
    Pass: { bg: COLORS.greenBg, color: COLORS.green, label: "완료" },
    Fail: { bg: COLORS.redBg, color: COLORS.red, label: "실패" },
    Pending: { bg: COLORS.indigoBg, color: COLORS.indigo, label: "진행 중" },
  };

  const s = map[status];
  return <Badge label={s.label} variant={status === "Pass" ? "success" : status === "Fail" ? "error" : "info"} />;
}

// ── Progress bar component ─────────────────────────────────────────────────
export function ProgressBar({
  current,
  total,
  animated = true,
}: {
  current: number;
  total: number;
  animated?: boolean;
}) {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: COLORS.textLight }}>
          {current} / {total} 완료
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.indigo }}>
          {progress}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: COLORS.indigoBg,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: COLORS.indigo,
            borderRadius: 999,
            transition: animated ? "width 0.5s ease" : "none",
          }}
        />
      </div>
    </div>
  );
}

// ── Tab component ──────────────────────────────────────────────────────────
export function TabGroup({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        padding: "8px 12px",
        borderBottom: `1px solid ${COLORS.borderSoft}`,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "none",
            background:
              activeTab === tab.key ? COLORS.indigo : "transparent",
            color: activeTab === tab.key ? "#fff" : COLORS.textMid,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {tab.label}{" "}
          {tab.count !== undefined && (
            <span style={{ opacity: 0.7 }}>({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Button component ───────────────────────────────────────────────────────
export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const variants = {
    primary: {
      background: COLORS.indigo,
      color: "#fff",
      hoverBg: COLORS.indigoDark,
    },
    secondary: {
      background: COLORS.glass,
      color: COLORS.textMid,
      hoverBg: COLORS.borderSoft,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: COLORS.redBg,
      color: COLORS.red,
      hoverBg: "#fde8e8",
      border: "1px solid #fecaca",
    },
  };

  const v = variants[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        border: "none",
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
        opacity: disabled ? 0.5 : 1,
        ...v,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = v.hoverBg;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background =
          v.background || "transparent";
      }}
    >
      {children}
    </button>
  );
}

// ── Timeline item component ────────────────────────────────────────────────
export function TimelineItem({
  stepNumber,
  title,
  description,
  isLast = false,
}: {
  stepNumber: number;
  title: string;
  description?: string;
  isLast?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12, position: "relative" }}>
      {/* Dot */}
      <div
        style={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: "50%",
          background: COLORS.glass,
          border: `2px solid ${COLORS.indigo}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: COLORS.indigo,
          position: "relative",
          zIndex: 1,
        }}
      >
        {stepNumber}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          padding: "12px 14px",
          background: COLORS.bgGray,
          borderRadius: 10,
          marginTop: 2,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: COLORS.text,
            margin: "0 0 4px",
          }}
        >
          Step {stepNumber}: {title}
        </p>
        {description && (
          <p
            style={{
              fontSize: 11,
              color: COLORS.textMid,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Stat box component ─────────────────────────────────────────────────────
export function StatBox({
  label,
  value,
  color = COLORS.text,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        background: COLORS.bgGray,
        borderRadius: 9,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: COLORS.textLight,
          display: "block",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 700,
          color,
          display: "block",
          marginTop: 4,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Accordion component ────────────────────────────────────────────────────
export function Accordion({
  title,
  icon,
  expanded: isExpanded,
  onToggle,
  children,
  variant = "default",
}: {
  title: string;
  icon?: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  variant?: "default" | "error" | "warning";
}) {
  const variants = {
    default: {
      border: COLORS.borderSoft,
      bg: COLORS.glass,
    },
    error: {
      border: COLORS.red,
      bg: COLORS.redBg,
    },
    warning: {
      border: COLORS.amber,
      bg: COLORS.amberBg,
    },
  };

  const v = variants[variant];
  const textColor =
    variant === "error"
      ? COLORS.red
      : variant === "warning"
        ? COLORS.amber
        : COLORS.text;

  return (
    <div
      style={{
        border: `1px solid ${v.border}`,
        borderRadius: 12,
        background: v.bg,
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        {icon && (
          <span style={{ fontSize: 16, flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: textColor,
            flex: 1,
            textAlign: "left",
          }}
        >
          {title}
        </span>
        <svg
          width="12"
          height="12"
          fill="none"
          stroke={textColor}
          strokeWidth="2"
          viewBox="0 0 12 12"
          style={{
            transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isExpanded && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: `1px solid ${v.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Icon components ────────────────────────────────────────────────────────
export function CheckCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="7.5"
        fill={color}
        fillOpacity=".12"
        stroke={color}
        strokeWidth="1"
      />
      <path
        d="M5 8l2 2 4-4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function XCircle({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle
        cx="8"
        cy="8"
        r="7.5"
        fill={color}
        fillOpacity=".08"
        stroke={color}
        strokeWidth="1"
      />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Divider component ──────────────────────────────────────────────────────
export function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: COLORS.borderSoft,
        margin: "12px 0",
      }}
    />
  );
}

// ── Empty state component ──────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "24px",
        color: COLORS.textLight,
      }}
    >
      <p
        style={{
          fontSize: 13,
          margin: 0,
          marginBottom: description ? 4 : 0,
        }}
      >
        {title}
      </p>
      {description && (
        <p style={{ fontSize: 11, margin: 0, color: COLORS.textFaint }}>
          {description}
        </p>
      )}
    </div>
  );
}
