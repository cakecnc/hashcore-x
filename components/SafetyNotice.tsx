export function SafetyNotice() {
  return (
    <aside className="safety-notice" aria-label="안전 안내">
      <span className="safety-icon" aria-hidden="true">!</span>
      <div>
        <strong>승인된 데이터에만 사용하세요.</strong>
        <p>
          텍스트 Utility는 브라우저에서 처리됩니다. GPU Runner는 사용자가 소유하거나 명시적으로 승인받은 로컬 데이터만 제한된 Hashcat 실행기로 처리합니다.
        </p>
      </div>
    </aside>
  );
}
