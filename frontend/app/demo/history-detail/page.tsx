"use client";

import { mockRunData, mockRunDataWithLoginFailure } from "@/lib/mockRunData";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  ProgressBar,
  TabGroup,
  TimelineItem,
  StatBox,
  Accordion,
  COLORS,
  CheckCircle,
  XCircle,
  EmptyState,
} from "@/components/ResultDetailComponents";
import { useState } from "react";

/**
 * Demo page showcasing the Result Detail Dashboard components
 * Access at: /demo/history-detail
 *
 * This page demonstrates:
 * 1. All reusable components from ResultDetailComponents
 * 2. Layout patterns for the result detail view
 * 3. Interactive component examples
 */

export default function HistoryDetailDemoPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [expandedAccordion, setExpandedAccordion] = useState(false);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bgGray,
        padding: "40px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Geist', sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px" }}>
            Result Detail Dashboard
          </h1>
          <p
            style={{
              fontSize: 14,
              color: COLORS.textLight,
              margin: 0,
            }}
          >
            Component library and layout examples for test result visualization
          </p>
        </div>

        {/* Full Layout Example */}
        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 16,
              color: COLORS.text,
            }}
          >
            Complete Layout Example
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1.5fr",
              gap: 24,
            }}
          >
            {/* Left Column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* Execution Summary */}
              <Card>
                <CardHeader
                  title="실행 결과"
                  subtitle={`${mockRunData.total} 케이스 · ${new Date(mockRunData.createdAt).toLocaleString("ko-KR")}`}
                  rightElement={
                    <Badge
                      label="완료"
                      variant="success"
                      size="md"
                    />
                  }
                />
                <div style={{ padding: "12px 20px 16px" }}>
                  <ProgressBar
                    current={mockRunData.passed}
                    total={mockRunData.total}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 12,
                    padding: "12px 20px 16px",
                    borderTop: `1px solid ${COLORS.borderSoft}`,
                  }}
                >
                  <StatBox
                    label="전체"
                    value={mockRunData.total}
                    color={COLORS.text}
                  />
                  <StatBox
                    label="성공"
                    value={mockRunData.passed}
                    color={COLORS.green}
                  />
                  <StatBox
                    label="실패"
                    value={mockRunData.failed}
                    color={COLORS.red}
                  />
                </div>
              </Card>

              {/* Login Failure Warning Example */}
              <Card>
                <Accordion
                  title="로그인 실패"
                  icon="🔑"
                  expanded={expandedAccordion}
                  onToggle={() =>
                    setExpandedAccordion(!expandedAccordion)
                  }
                  variant="error"
                >
                  <div>
                    <p
                      style={{
                        fontSize: 11,
                        color: COLORS.textLight,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        margin: "0 0 6px",
                      }}
                    >
                      실패 사유
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: COLORS.text,
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      {
                        mockRunDataWithLoginFailure.loginFailReason
                      }
                    </p>
                  </div>
                  {mockRunDataWithLoginFailure.loginSteps && (
                    <div>
                      <p
                        style={{
                          fontSize: 11,
                          color: COLORS.textLight,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          margin: "0 0 6px",
                        }}
                      >
                        실행 단계
                      </p>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {mockRunDataWithLoginFailure.loginSteps.map(
                          (step, i) => (
                            <div
                              key={i}
                              style={{
                                display: "flex",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: COLORS.indigo,
                                  flexShrink: 0,
                                }}
                              >
                                {i + 1}.
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: COLORS.textMid,
                                }}
                              >
                                {step}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </Accordion>
              </Card>

              {/* Scenario List */}
              <Card style={{ display: "flex", flexDirection: "column" }}>
                <TabGroup
                  tabs={[
                    { key: "all", label: "전체", count: 5 },
                    { key: "pass", label: "✅ 완료", count: 3 },
                    { key: "fail", label: "❌ 실패", count: 2 },
                    { key: "review", label: "⚠️ 확인 필요", count: 1 },
                  ]}
                  activeTab={activeTab}
                  onChange={setActiveTab}
                />
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {mockRunData.cases.slice(0, 3).map((tc) => (
                    <div
                      key={tc.testId}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 11,
                        border: `1px solid ${COLORS.borderSoft}`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = COLORS.indigo;
                        e.currentTarget.style.background = COLORS.glass;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor =
                          COLORS.borderSoft;
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <div style={{ flexShrink: 0, marginTop: 2 }}>
                          {tc.status === "Pass" ? (
                            <CheckCircle color={COLORS.green} />
                          ) : (
                            <XCircle color={COLORS.red} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: 12.5,
                              color: COLORS.text,
                              lineHeight: 1.45,
                              margin: 0,
                            }}
                          >
                            {tc.scenario}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Button
                onClick={() => alert("Redirecting to /new with scenarios...")}
              >
                시나리오 수정 후 재시도
              </Button>
            </div>

            {/* Right Column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* Media Viewer */}
              <Card
                style={{
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 300,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      textAlign: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 48,
                        display: "block",
                      }}
                    >
                      📸
                    </span>
                    <p
                      style={{
                        fontSize: 13,
                        color: COLORS.textLight,
                        margin: "8px 0 0",
                      }}
                    >
                      스크린샷 없음
                    </p>
                  </div>
                </div>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader title="실행 타임라인" />
                <div
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {mockRunData.cases[0]?.consoleLogs
                    ?.slice(0, 4)
                    .map((log, i) => {
                      const m = log.match(
                        /^\[Step (\d+)\]\s+(.+?)(?:\s+—\s+(.+))?$/
                      );
                      const num = m ? m[1] : i + 1;
                      const action = m ? m[2] : log;
                      const details = m ? m[3] : "";

                      return (
                        <TimelineItem
                          key={i}
                          stepNumber={typeof num === 'number' ? num : parseInt(num, 10)}
                          title={action}
                          description={details}
                        />
                      );
                    })}
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Component Library */}
        <section style={{ marginBottom: 48 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 16,
              color: COLORS.text,
            }}
          >
            Component Library
          </h2>

          {/* Badges */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Badges
            </h3>
            <div
              style={{
                background: COLORS.glass,
                borderRadius: 12,
                padding: "16px",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Badge label="Default" variant="default" />
              <Badge label="Success" variant="success" />
              <Badge label="Error" variant="error" />
              <Badge label="Warning" variant="warning" />
              <Badge label="Info" variant="info" />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Buttons
            </h3>
            <div
              style={{
                background: COLORS.glass,
                borderRadius: 12,
                padding: "16px",
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <Button
                onClick={() => alert("Primary button clicked")}
              >
                Primary
              </Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="danger">Danger</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>

          {/* Stat Boxes */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Stat Boxes
            </h3>
            <div
              style={{
                background: COLORS.glass,
                borderRadius: 12,
                padding: "16px",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              <StatBox label="Total" value={25} color={COLORS.text} />
              <StatBox label="Passed" value={20} color={COLORS.green} />
              <StatBox label="Failed" value={5} color={COLORS.red} />
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Progress Bar
            </h3>
            <div
              style={{
                background: COLORS.glass,
                borderRadius: 12,
                padding: "16px",
              }}
            >
              <ProgressBar current={75} total={100} />
            </div>
          </div>

          {/* Empty State */}
          <div style={{ marginBottom: 24 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Empty State
            </h3>
            <Card>
              <EmptyState
                title="No test cases found"
                description="Try running a test or changing your filter"
              />
            </Card>
          </div>
        </section>

        {/* Data Structure */}
        <section>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 16,
              color: COLORS.text,
            }}
          >
            Mock Data Structure
          </h2>
          <Card>
            <div style={{ padding: "16px 20px" }}>
              <pre
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: COLORS.textMid,
                  overflowX: "auto",
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(mockRunData, null, 2).slice(0, 500)}
                ...
              </pre>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
