// 관리자 토큰 클라이언트 저장소 — 비밀번호 원문 대신 워커가 발급한 파생 토큰만 보관.
// 관리자 비밀번호를 변경하면 워커에서 토큰이 무효화되어 재인증이 필요해진다.

const KEY = "qagent_admin_token";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY) || "";
}

export function setAdminToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function clearAdminToken(): void {
  localStorage.removeItem(KEY);
}
