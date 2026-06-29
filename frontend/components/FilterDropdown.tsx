"use client";

import { useState, useRef, useEffect } from "react";

export interface FilterOption {
  key: string;
  label: string;
}

interface FilterDropdownProps {
  label: string;
  icon: React.ReactNode;
  options: FilterOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
}

const A = {
  blue:      "#0066cc",
  ink:       "#1d1d1f",
  inkMuted:  "#6b7280",
  hairline:  "#e0e0e0",
  divider:   "#f0f0f0",
  canvas:    "#ffffff",
  parchment: "#f5f5f7",
};

export default function FilterDropdown({
  label,
  icon,
  options,
  selectedValues,
  onSelectionChange,
}: FilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleCheckboxChange = (key: string) => {
    const newSelected = selectedValues.includes(key)
      ? selectedValues.filter((v) => v !== key)
      : [...selectedValues, key];
    onSelectionChange(newSelected);
  };

  const getSummaryText = (): string => {
    if (selectedValues.length === 0) {
      return label;
    }
    if (selectedValues.length === 1) {
      const opt = options.find((o) => o.key === selectedValues[0]);
      return opt ? opt.label : label;
    }
    // 2개 이상 선택된 경우: "첫번째 항목 외 N개"
    const firstOpt = options.find((o) => o.key === selectedValues[0]);
    const count = selectedValues.length - 1;
    return `${firstOpt?.label} 외 ${count}`;
  };

  const getSelectedLabels = (): string[] => {
    return selectedValues
      .map((key) => options.find((o) => o.key === key)?.label)
      .filter(Boolean) as string[];
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        display: "inline-block",
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* 드롭다운 버튼 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          borderRadius: 8,
          border: `1px solid ${A.hairline}`,
          background: A.canvas,
          cursor: "pointer",
          transition: "all 0.12s",
          color: selectedValues.length === 0 ? A.inkMuted : A.blue,
          fontSize: 13,
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = A.blue;
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(0, 102, 204, 0.04)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = A.hairline;
          (e.currentTarget as HTMLButtonElement).style.background = A.canvas;
        }}
      >
        {/* 아이콘 */}
        <span style={{ display: "flex", alignItems: "center", color: A.inkMuted }}>
          {icon}
        </span>

        {/* 텍스트 */}
        <span>{getSummaryText()}</span>

        {/* 드롭다운 화살표 */}
        <svg
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 12 12"
          style={{
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 드롭다운 메뉴 */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            background: A.canvas,
            border: `1px solid ${A.hairline}`,
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
            zIndex: 50,
            minWidth: 220,
            animation: "fadeIn 0.15s ease-out",
          }}
        >
          {options.map((option) => (
            <label
              key={option.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                padding: "10px 14px",
                cursor: "pointer",
                transition: "background 0.1s",
                background: selectedValues.includes(option.key)
                  ? "rgba(0, 102, 204, 0.05)"
                  : A.canvas,
                borderBottom: option !== options[options.length - 1] ? `1px solid ${A.divider}` : "none",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = "rgba(0, 102, 204, 0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLLabelElement).style.background = selectedValues.includes(
                  option.key
                )
                  ? "rgba(0, 102, 204, 0.05)"
                  : A.canvas;
              }}
            >
              <input
                type="checkbox"
                checked={selectedValues.includes(option.key)}
                onChange={() => handleCheckboxChange(option.key)}
                style={{
                  width: 16,
                  height: 16,
                  cursor: "pointer",
                  accentColor: A.blue,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: A.ink,
                  fontWeight: 500,
                }}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Hover 팝오버: 선택된 모든 항목 표시 */}
      {isHovering && selectedValues.length > 1 && !isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            marginBottom: 8,
            background: A.ink,
            color: "#fff",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            whiteSpace: "nowrap",
            zIndex: 40,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {getSelectedLabels().join(", ")}
          <div
            style={{
              position: "absolute",
              bottom: "-4px",
              left: 12,
              width: 0,
              height: 0,
              borderLeft: "4px solid transparent",
              borderRight: "4px solid transparent",
              borderTop: `4px solid ${A.ink}`,
            }}
          />
        </div>
      )}

      {/* 드롭다운 열릴 때 애니메이션 CSS */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
