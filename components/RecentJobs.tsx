"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { getHistorySnapshot, readHistorySnapshot, subscribeHistory } from "@/lib/history";

const getServerSnapshot = () => "[]";

export function RecentJobs() {
  const snapshot = useSyncExternalStore(subscribeHistory, getHistorySnapshot, getServerSnapshot);
  const records = readHistorySnapshot(snapshot).slice(0, 3);

  return (
    <section className="recent-section" aria-labelledby="recent-heading">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">RECENT ACTIVITY</span>
          <h2 id="recent-heading">최근 작업</h2>
        </div>
        <Link href="/history">전체 기록 보기</Link>
      </div>
      {records.length ? (
        <div className="recent-list">
          {records.map((record) => (
            <Link key={record.id} href={`/workspace?tool=${record.toolId}`} className="recent-item">
              <span className="status-dot" aria-hidden="true" />
              <span>
                <strong>{record.toolName}</strong>
                <small>{new Date(record.createdAt).toLocaleString("ko-KR")}</small>
              </span>
              <span>{record.outputCount.toLocaleString("ko-KR")}개 <b aria-hidden="true">→</b></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="recent-empty">
          <p>아직 저장된 작업 메타데이터가 없습니다.</p>
          <Link href="/workspace">첫 작업 시작하기</Link>
        </div>
      )}
      <p className="privacy-note">입력값과 결과 원문은 기록에 저장하지 않습니다.</p>
    </section>
  );
}
