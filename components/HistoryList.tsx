"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  clearHistory,
  deleteHistory,
  getHistorySnapshot,
  readHistorySnapshot,
  subscribeHistory,
} from "@/lib/history";

const getServerSnapshot = () => "[]";

export function HistoryList() {
  const snapshot = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerSnapshot);
  const records = readHistorySnapshot(snapshot);

  const remove = (recordId: string) => {
    deleteHistory(window.localStorage, recordId);
  };

  return (
    <section aria-labelledby="history-heading">
      <div className="page-heading page-heading-with-action">
        <div>
          <span className="eyebrow">LOCAL METADATA ONLY</span>
          <h1 id="history-heading">최근 작업 기록</h1>
          <p>도구, 시간, 상태와 항목 수만 이 기기에 저장됩니다.</p>
        </div>
        {records.length ? (
          <button className="button button-secondary" type="button" onClick={() => clearHistory(window.localStorage)}>
            전체 삭제
          </button>
        ) : null}
      </div>
      {records.length ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>작업</th>
                <th>시간</th>
                <th>상태</th>
                <th>항목</th>
                <th><span className="visually-hidden">작업</span></th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><strong>{record.toolName}</strong><small>{record.toolId}</small></td>
                  <td>{new Date(record.createdAt).toLocaleString("ko-KR")}</td>
                  <td><span className={`history-status status-${record.status}`}>{record.status === "completed" ? "완료" : "실패"}</span></td>
                  <td>{record.inputCount.toLocaleString("ko-KR")} → {record.outputCount.toLocaleString("ko-KR")}</td>
                  <td className="history-actions">
                    <Link href={`/workspace?tool=${record.toolId}`}>다시 열기</Link>
                    <button type="button" onClick={() => remove(record.id)} aria-label={`${record.toolName} 작업 삭제`}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state history-empty">
          <span aria-hidden="true">◷</span>
          <h2>작업 기록이 없습니다</h2>
          <p>Utility를 실행하면 민감 원문을 제외한 메타데이터가 표시됩니다.</p>
          <Link className="button button-primary" href="/workspace">워크스페이스 열기</Link>
        </div>
      )}
      <aside className="data-policy-card">
        <strong>개인정보 보호 설계</strong>
        <p>다시 열기는 동일한 도구와 설정 화면을 엽니다. 입력 및 결과 원문은 복원되지 않습니다.</p>
      </aside>
    </section>
  );
}
